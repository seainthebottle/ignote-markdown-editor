
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
import mdiFootNote from "markdown-it-footnote";
import mdiAbbr from "markdown-it-abbr";
import mdiMark from "markdown-it-mark";
import mdiDeflist from "markdown-it-deflist";
import mdiTasks from "markdown-it-tasks";
import mdiSup from "markdown-it-sup";
import mdiSub from "markdown-it-sub";
//import mdiLinenumbers from "markdown-it-inject-linenumbers";

import markdownItImageSize from "./markdown-it-imgsize";

// 🚀 StateEffect를 전역에서 정의 (클래스 외부에서 한 번만 선언)
const IgnoreUpdateEffect = StateEffect.define();

export default class IgnoteMarkdownEditor {
    constructor(editorContainer, previewContainer, initialContent = "") {

        this.editorContainer = editorContainer;
        //this.previewContainer = previewContainer;

        this.md = new MarkdownIt({
            html: true,
            breaks: true,
            linkify: true,
            typographer: true,
            html: true,
            xhtmlOut: false,
            breaks: false,
            linkify: true,
            typographer: true
        })
            .use(mdiFootNote)
            .use(mdiAbbr)
            .use(mdiMark)
            .use(mdiDeflist)
            .use(mdiTasks, { enabled: true })
            .use(mdiSup)
            .use(mdiSub)
            .use(markdownItImageSize)
        //.use(mdiLinenumbers);

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
                updateListener
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
            effects: IgnoreUpdateEffect.of(null) // StateEffect 추가(업데이트 이벤트 발생을 막기 위해)
        });
        this.updatePreview();
    }

    // 에디터 이벤트 리스너 추가
    addEventListeners() {
        this.editorContainer.addEventListener("keyup", () => this.updatePreview());
    }
}
