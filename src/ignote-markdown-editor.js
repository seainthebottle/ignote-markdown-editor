
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/basic-setup";
import { keymap, drawSelection, highlightActiveLine, dropCursor,
    rectangularSelection, crosshairCursor,
    lineNumbers, highlightActiveLineGutter } from "@codemirror/view"
import {Compartment, StateEffect, EditorState} from "@codemirror/state"
import {searchKeymap, highlightSelectionMatches} from "@codemirror/search"
import "style-mod";

import MarkdownIt from "https://cdn.skypack.dev/markdown-it";

export default class IgnoteMarkdownEditor {
    constructor(editorContainer, previewContainer, initialContent = "") {
        this.editorContainer = editorContainer;
        //this.previewContainer = previewContainer;
        this.md = new MarkdownIt();

        const container = document.getElementById('PageEditorContainer')
        const baseFont = EditorView.theme({
            ".cm-content": { 
                fontSize: window.getComputedStyle(this.editorContainer).getPropertyValue('font-size'),
                fontFamily: window.getComputedStyle(this.editorContainer).getPropertyValue('font-family'),
                lineHeight: window.getComputedStyle(this.editorContainer).getPropertyValue('line-height')
            }
        });


        const fixedHeightEditor = EditorView.theme({
            "&.cm-editor": {height: "100%"},
            ".cm-scroller": {overflow: "auto"}
        });

        // CodeMirror 초기화
        /*let state = EditorState.create({
            extensions: [
                baseFont,
                fixedHeightEditor,
                EditorView.lineWrapping,
                lineNumbers(),
                //highlightActiveLineGutter(),
                //history(),
                //drawSelection(),
                dropCursor(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightSelectionMatches(),
                markdown({ base: markdownLanguage })
            ],
            doc: initialContent
        });

        this.editor = new EditorView({
            state,
            parent: this.editorContainer
        });*/

        this.editor = new EditorView({
            doc: initialContent,
            extensions: [
                //basicSetup,
                baseFont,
                fixedHeightEditor,
                EditorView.lineWrapping,
                lineNumbers(),
                //highlightActiveLineGutter(),
                //history(),
                //drawSelection(),
                dropCursor(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightSelectionMatches(),
                markdown({ base: markdownLanguage })
            ],
            parent: this.editorContainer
        });

        // Markdown 변경 감지
        this.editor.dispatch({
            changes: { from: 0, to: this.editor.state.doc.length, insert: initialContent }
        });

        this.updatePreview();
        this.addEventListeners();
    }

    // Markdown 미리보기 업데이트
    updatePreview() {
        const content = this.getValue();
        //this.previewContainer.innerHTML = this.md.render(content);
    }

    // 값 가져오기
    getValue() {
        return this.editor.state.doc.toString();
    }

    // 값 설정하기
    setValue(content) {
        this.editor.dispatch({
            changes: { from: 0, to: this.editor.state.doc.length, insert: content }
        });
        this.updatePreview();
    }

    // 에디터 이벤트 리스너 추가
    addEventListeners() {
        this.editorContainer.addEventListener("keyup", () => this.updatePreview());
    }
}
