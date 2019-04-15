/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

// The editor creator to use.
import InlineEditorBase from '@ckeditor/ckeditor5-editor-inline/src/inlineeditor';
import InlineEditorUIView from '@ckeditor/ckeditor5-editor-inline/src/inlineeditoruiview';
import InlineEditableUIView from '@ckeditor/ckeditor5-ui/src/editableui/inline/inlineeditableuiview';
import EditorUI from '@ckeditor/ckeditor5-core/src/editor/editorui';

import HtmlDataProcessor from '@ckeditor/ckeditor5-engine/src/dataprocessor/htmldataprocessor';
import attachToForm from '@ckeditor/ckeditor5-core/src/editor/utils/attachtoform';
import ElementReplacer from '@ckeditor/ckeditor5-utils/src/elementreplacer';
import getDataFromElement from '@ckeditor/ckeditor5-utils/src/dom/getdatafromelement';

import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import Autoformat from '@ckeditor/ckeditor5-autoformat/src/autoformat';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import CKFinder from '@ckeditor/ckeditor5-ckfinder/src/ckfinder';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import PasteFromOffice from '@ckeditor/ckeditor5-paste-from-office/src/pastefromoffice';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar';

// Interfaces to extend the basic Editor API.
import DataApiMixin from '@ckeditor/ckeditor5-core/src/editor/utils/dataapimixin';
import ElementApiMixin from '@ckeditor/ckeditor5-core/src/editor/utils/elementapimixin';

// Helper function for adding interfaces to the Editor class.
import mix from '@ckeditor/ckeditor5-utils/src/mix';

export default class InlineEditor extends InlineEditorBase {
	constructor(sourceElementOrData, config) {
		super(config);
		this.sourceElement = sourceElementOrData;
		this.data.processor = new HtmlDataProcessor();
		this.ui = new PodiumInlineEditorUI(this);
		attachToForm(this);
		console.log('constructed');
	}

	destroy() {
		// When destroyed, the editor sets the output of editor#getData() into editor#element...
		this.updateSourceElement();

		// ...and destroys the UI.
		this.ui.destroy();

		return super.destroy();
	}

	static create(element, config) {
		return new Promise(resolve => {
			const editor = new this(element, config);

			resolve(
				editor.initPlugins()
					// Initialize the UI first. See the BootstrapEditorUI class to learn more.
					.then(() => editor.ui.init(element))
					// Fill the editable with the initial data.
					.then(() => editor.data.init(getDataFromElement(element)))
					// Fire the `editor#ready` event that announce the editor is complete and ready to use.
					.then(() => editor.fire('ready'))
					.then(() => editor)
			);
		});
	}
}

mix(InlineEditor, DataApiMixin);
mix(InlineEditor, ElementApiMixin);

class PodiumInlineEditorUI extends EditorUI {
	constructor(editor) {
		super(editor);

		// A helper to easily replace the editor#element with editor.editable#element.
		this._elementReplacer = new ElementReplacer();

		// The global UI view of the editor. It aggregates various Bootstrap DOM elements.
		const view = this._view = new InlineEditorUIView(editor.locale);

		// This is the main editor element in the DOM.
		view.element = $('.ck-editor');

		// This is the editable view in the DOM. It will replace the data container in the DOM.
		view.editable = new InlineEditableUIView(editor.locale, editor.editing.view);

		// References to the dropdown elements for further usage. See #_setupBootstrapHeadingDropdown.
		view.linkButton = view.element.find('.link-button');

		// References to the toolbar buttons for further usage. See #_setupBootstrapToolbarButtons.
		view.toolbarButtons = {};

		[
			'bold',
			'bulletedList',
			'numberedList',
			'insertTable',
			'link',
			'unlink',
			'insertTableRowAbove',
			'insertTableRowBelow',
			'insertTableColumnLeft',
			'insertTableColumnRight',
			'removeTableRow',
			'removeTableColumn'
		].forEach(name => {
			// Retrieve the jQuery object corresponding with the button in the DOM.
			view.toolbarButtons[name] = view.element.find(`#${name}`);
		});
	}

	// All EditorUI subclasses should expose their view instance
	// so other UI classes can access it if necessary.
	get view() {
		return this._view;
	}

	init(replacementElement) {
		const editor = this.editor;
		const view = this.view;
		const editingView = editor.editing.view;

		// Create an editing root in the editing layer. It will correspond with the
		// document root created in the constructor().
		const editingRoot = editingView.document.getRoot();

		// The editable UI and editing root should share the same name.
		view.editable.name = editingRoot.rootName;

		// Render the editable component in the DOM first.
		view.editable.render();

		const editableElement = view.editable.element;

		// Register editable element so it is available via getEditableElement() method.
		this._editableElements.set(view.editable.name, editableElement);

		// Let the editable UI element respond to the changes in the global editor focus tracker
		// and let the focus tracker know about the editable element.
		this.focusTracker.add(editableElement);
		view.editable.bind('isFocused').to(this.focusTracker);

		// Bind the editable UI element to the editing view, making it an end– and entry–point
		// of the editor's engine. This is where the engine meets the UI.
		editingView.attachDomRoot(editableElement);

		// Setup the existing, external Bootstrap UI so it works with the rest of the editor.
		this._setupBootstrapToolbarButtons();

		// Replace the editor#element with editor.editable#element.
		this._elementReplacer.replace(replacementElement, editableElement);

		// Tell the world that the UI of the editor is ready to use.
		this.fire('ready');

		this._setupAnchorLinksEvent();

		this._setUpUnlinkEvent();

		this._setUpCreateLinkPopupEvent();

		this._setUpCreateLinkEvent();

		this._setUpToggleEditLinkEvent();
	}

	/**
	 * This function is ran when the user clicks the edit button on the preview pop up.
	 */
	_setUpToggleEditLinkEvent() {
		var positionPopupAtCurrentSelection = this._positionLinkPopupAtCurrentSelection;
		document.getElementById('edit-url').addEventListener('click', function (event) {
			var linkPreviewPopup = $('#link-preview-popup');
			linkPreviewPopup.hide();
			var existingUrl = $('#link-preview-url').attr('href');
			$('#link-url').val(existingUrl);
			var linkPreviewPopup = $('#link-create-popup');
			positionPopupAtCurrentSelection(linkPreviewPopup);
			linkPreviewPopup.show();
		})
	}

	/**
	 * This function is ran when the user clicks on the save button on the create link pop up.
	 */
	_setUpCreateLinkEvent() {
		$('#link').on('click', function (event) {
			var linkUrl = $('#link-url').val();
			var linkCreatePopup = $('#link-create-popup');
			editor.execute('link', linkUrl);
			$('#link-url').val(''); // Reset the form;
			linkCreatePopup.hide();
		});
	}

	/**
	 * This function runs when you click on the toolbar to create a link.
	 * It will show the create link pop up.
	 */
	_setUpCreateLinkPopupEvent() {
		var positionPopupAtCurrentSelection = this._positionLinkPopupAtCurrentSelection;
		$('#show-link-popup').on('click', function (event) {
			var selectedText = window.getSelection().toString();
			if (selectedText.length) {
				var linkPopup = $('#link-create-popup');

				// Show the selected text in the url bar.
				$('#link-url').val(selectedText);

				positionPopupAtCurrentSelection(linkPopup);
				linkPopup.show();
			}
		});
	}

	/**
	 * This function is ran when the user clicks on the remove url button on the preview url toolbar.
	 */
	_setUpUnlinkEvent() {
		$('#unlink').on('click', function (event) {
			var linkPreviewPopup = $('#link-preview-popup');
			linkPreviewPopup.hide();
			editor.execute('unlink');
		});
	}

	/**
	 * This function is ran when the user clicks on an anchor link within the editor.
	 * So it will show the url preview toolbar.
	 */
	_setupAnchorLinksEvent() {
		var positionPopupAtCurrentSelection = this._positionLinkPopupAtCurrentSelection;
		$('.ck').on('click', function (event) {
			var linkPreviewPopup = $('#link-preview-popup');
			var linkCreatePopup = $('#link-create-popup');
			if (event.target.nodeName === 'A') {
				event.preventDefault();
				event.stopPropagation();

				linkCreatePopup.hide();

				positionPopupAtCurrentSelection(linkPreviewPopup);

				var linkHref = event.target.href;

				// Add url to the preview anchor tag.
				$('#link-preview-url').attr('href', linkHref);
				$('#link-preview-url').text(linkHref);
				linkPreviewPopup.show();
				return false;
			} else {
				linkPreviewPopup.hide();
				linkCreatePopup.hide();
				$('#link-url').val(''); // Reset the form
			}
		});
	}

	_positionLinkPopupAtCurrentSelection(popup) {
		var s = window.getSelection();
		var oRange = s.getRangeAt(0); //get the text range
		var oRect = oRange.getBoundingClientRect();
		// Move pop up into position.
		popup.css({ top: oRect.top + 60, left: oRect.left - 5, position: 'absolute' });
	}

	destroy() {
		// Restore the original editor#element.
		this._elementReplacer.restore();

		// Destroy the view.
		this._view.editable.destroy();
		this._view.destroy();
		super.destroy();
	}


	_setupBootstrapToolbarButtons() {
		const editor = this.editor;

		for (const name in this.view.toolbarButtons) {
			// Retrieve the editor command corresponding with the ID of the button in the DOM.
			const command = this.editor.commands.get(name);
			const button = this.view.toolbarButtons[name];

			// Clicking the buttons should execute the editor command...
			button.click(() => {
				if (name !== 'link') {
					editor.execute(name);
				}
			});

			// ...but it should not steal the focus so the editing is uninterrupted.
			button.mousedown(evt => evt.preventDefault());

			const onValueChange = () => {
				button.toggleClass('active', command.value);
			};

			const onIsEnabledChange = () => {
				button.attr('disabled', () => !command.isEnabled);
			};

			// Commands can become disabled, e.g. when the editor is read-only.
			// Make sure the buttons reflect this state change.
			command.on('change:isEnabled', onIsEnabledChange);
			onIsEnabledChange();
		}
	}
}

// Plugins to include in the build.
InlineEditor.builtinPlugins = [
	Essentials,
	Autoformat,
	Bold,
	CKFinder,
	Link,
	List,
	PasteFromOffice,
	Table,
	TableToolbar
];
