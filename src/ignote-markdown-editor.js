
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { nord } from "cm6-theme-nord";
import {
    EditorView, keymap, drawSelection, highlightActiveLine, dropCursor,
    rectangularSelection, crosshairCursor,
    lineNumbers, highlightActiveLineGutter
} from "@codemirror/view"
import { Compartment, StateEffect, EditorState } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import MarkdownIt from "markdown-it";

export default class IgnoteMarkdownEditor {
    constructor(editorContainer, previewContainer, initialContent = "") {
        this.editorContainer = editorContainer;
        //this.previewContainer = previewContainer;
        this.md = new MarkdownIt();
        this.broadcastChannel = new BroadcastChannel("ignote_channel");

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                //console.log("sent content_edited from ignote-markdown-editor")
                // 내용 변경이 있으면 메시지를 방송한다.
                let sendData = { command: "content_edited", data: null };
                this.broadcastChannel.postMessage(sendData);
            }
        });
        // setValue에서 내용변경시 updateListener가 발동되지 않도록 transaction을 pass하는 effect를 추가해야 한다.
        this.IgnoreUpdateEffect = StateEffect.define();
        const filterUpdateExtension = EditorState.transactionFilter.of(tr => {
            if (tr.effects.some(e => e.is(this.IgnoreUpdateEffect))) return []; // 특정 트랜잭션을 무시
            else return [tr];
        });
        

        const fixedHeightEditor = EditorView.theme({
            "&.cm-editor": { height: "100%" },
            ".cm-scroller": { overflow: "auto" }
        });

        // CodeMirror 초기화
        const state = EditorState.create({
            doc: initialContent,
            extensions: [
                oneDark,
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
                markdown({ base: markdownLanguage }),
                keymap.of([
                    ...defaultKeymap,
                    ...searchKeymap,
                    ...historyKeymap
                ]),
                updateListener,
                filterUpdateExtension 
            ]
        });

        this.editor = new EditorView({
            state,
            parent: this.editorContainer
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

    getOutputValue() {
        return this.md.render(this.editor.state.doc.toString());
    }

    // 값 설정하기
    setValue(content) {
        this.editor.dispatch({
            changes: { from: 0, to: this.editor.state.doc.length, insert: content },
            effects: this.IgnoreUpdateEffect.of(null) // StateEffect 추가(업데이트 이벤트 발생을 막기 위해)
        });
        this.updatePreview();
    }

    // 에디터 이벤트 리스너 추가
    addEventListeners() {
        this.editorContainer.addEventListener("keyup", () => this.updatePreview());
    }
}
