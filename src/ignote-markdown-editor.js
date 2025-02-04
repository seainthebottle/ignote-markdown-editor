
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { nord } from "cm6-theme-nord";
import { EditorView, keymap, drawSelection, highlightActiveLine, dropCursor,
    rectangularSelection, crosshairCursor,
    lineNumbers, highlightActiveLineGutter } from "@codemirror/view"
import {Compartment, StateEffect, EditorState} from "@codemirror/state"
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands"
import {searchKeymap, highlightSelectionMatches} from "@codemirror/search"
import MarkdownIt from "markdown-it";

export default class IgnoteMarkdownEditor {
    constructor(editorContainer, previewContainer, initialContent = "") {
        this.editorContainer = editorContainer;
        //this.previewContainer = previewContainer;
        this.md = new MarkdownIt();

        const baseFont = EditorView.theme({
            ".cm-content": { 
                fontSize: window.getComputedStyle(this.editorContainer).getPropertyValue('font-size'),
                fontFamily: window.getComputedStyle(this.editorContainer).getPropertyValue('font-family'),
                lineHeight: window.getComputedStyle(this.editorContainer).getPropertyValue('line-height')
            }
        });

        const fixedHeightEditor = EditorView.theme({
            "&.cm-editor": {height: "100%"},
            ".cm-scroller": {overflow: "scroll"}
        });

        // CodeMirror 초기화
        const state = EditorState.create({
            doc: initialContent,
            extensions: [
                oneDark,
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
            ]
        });

        this.editor = new EditorView({
            state,
            parent: this.editorContainer
        });

        /*this.editor = new EditorView({
            doc: initialContent,
            extensions: [
                //basicSetup,
                nord,
                baseFont,
                fixedHeightEditor,
                EditorView.lineWrapping,
                lineNumbers(),
                //highlightActiveLineGutter(),
                history(),
                //drawSelection(),
                dropCursor(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightSelectionMatches(),
                markdown({ base: markdownLanguage })
            ],
            parent: this.editorContainer
        });*/

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
