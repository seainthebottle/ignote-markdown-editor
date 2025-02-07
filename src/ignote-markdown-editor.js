
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

// 🚀 StateEffect를 전역에서 정의 (클래스 외부에서 한 번만 선언)
const IgnoreUpdateEffect = StateEffect.define();

export default class IgnoteMarkdownEditor {
    constructor(editorContainer, previewContainer, initialContent = "") {
        this.editorContainer = editorContainer;
        //this.previewContainer = previewContainer;
        this.md = new MarkdownIt();
        this.broadcastChannel = new BroadcastChannel("ignote_channel");

        // updateListener: 특정 Effect가 없는 경우에만 실행
        const updateListener = EditorView.updateListener.of((update) => {
            if (update.transactions.some(tr => tr.effects.some(e => e.is(IgnoreUpdateEffect)))) {
                return; // 'IgnoreUpdateEffect'가 포함된 트랜잭션은 무시
            }
            if (update.docChanged) {
                //console.log("sent content_edited from ignote-markdown-editor")
                // 내용 변경이 있으면 메시지를 방송한다.
                let sendData = { command: "content_edited", data: null };
                this.broadcastChannel.postMessage(sendData);
            }
        });


        const fixedHeightEditor = EditorView.theme({
            "&.cm-editor": { height: "100%" },
            ".cm-scroller": { overflow: "auto" }
        });

        // CodeMirror 초기화
        this.state = EditorState.create({
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
                updateListener
            ]
        });

        this.editor = new EditorView({
            state: this.state,
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
            effects: IgnoreUpdateEffect.of(null) // StateEffect 추가(업데이트 이벤트 발생을 막기 위해)
        });
        this.updatePreview();
    }

    // Insert markdown text into the editor at current cursor position
    insertMarkdownText(markdownText) {
        let selection = this.editor.state.selection;
        let curFrom = selection.main.from;
        let curTo = selection.main.to;
        let newCursorPosition = curFrom + markdownText.length; // 커서 위치 조정
    
        // 트랜잭션 생성 후 dispatch 실행
        this.editor.dispatch({
            changes: { from: curFrom, to: curTo, insert: markdownText },
            selection: { anchor: newCursorPosition, head: newCursorPosition }
        });
    
        this.updatePreview();

        /*// 현재 커서 위치에 덮어쓰기를 한다.
        var selection = this.state.selection;
        var curFrom = selection.main.from;
        var curTo = selection.main.to;
        var update = this.state.update(
            { changes: { from: curFrom, to: curTo, insert: markdownText } },
            { selection: { anchor: newCursorPosition, head: newCursorPosition } }
        );

        // 커서를 새로 교체한 text의 끝에 위치시킨다. 그래야 순서가 올바르게 삽입된다.
        var newCursorPosition = curTo + markdownText.length;
        var move = { selection: { anchor: newCursorPosition, head: newCursorPosition } };

        // 위의 transaction 들을 반영한다.
        this.editor.dispatch(update);
        this.editor.dispatch(move);

        // preview에도 반영한다.
        //if(this.previewEnabled) this.rmdePreview.renderMarkdownTextToPreview(this);*/
    }

    // 에디터 이벤트 리스너 추가
    addEventListeners() {
        this.editorContainer.addEventListener("keyup", () => this.updatePreview());
    }
}
