
//import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { nord } from "cm6-theme-nord";
import {
    EditorView, keymap, drawSelection, highlightActiveLine, dropCursor,
    rectangularSelection, crosshairCursor,
    lineNumbers, highlightActiveLineGutter
} from "@codemirror/view"
import { Compartment, StateEffect, EditorState } from "@codemirror/state"
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldKeymap } from "@codemirror/language"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import {autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap} from "@codemirror/autocomplete"
import { markdown } from "./lib/lang-markdown";
import { GFM, Superscript, Subscript, Emoji } from "./lib/markdown";
import { mdpTexInline, mdpTexBlock, mdpMark, mdpFootnote } from "./lib/additional-markdown-parser";
import MarkdownIt from "markdown-it";
import mdiFootNote from "markdown-it-footnote";
import mdiAbbr from "markdown-it-abbr";
import mdiMark from "markdown-it-mark";
import mdiDeflist from "markdown-it-deflist";
import mdiTasks from "markdown-it-tasks";
import mdiSup from "markdown-it-sup";
import mdiSub from "markdown-it-sub";

import IgmePreview from "./lib/igme-preview";

import markdownItImageSize from "./lib/markdown-it-imgsize";
import markdownitMathjax from "./lib/markdown-it-mathjax";
import markdownItInjectLineNumbers from "./lib/markdown-it-inject-linenumbers";

// 🚀 StateEffect를 전역에서 정의 (클래스 외부에서 한 번만 선언)
const IgnoreUpdateEffect = StateEffect.define();

export default class IgnoteMarkdownEditor {
    constructor(mainContainer, previewContainer, initialContent = "") {

        this.previewEnabled = false;
        this.resizeTimer = null;
        this.previewTimer = null;
        this.mathJaxTimer = null;
        this.autosaveTimer = null;
        this.autosaveFlag = false;

        this.mousepagex = null;
        this.mousepagey = null;

        this.arrowKeyDown = false;
        this.onPasteInput = false;


        // 컨테이너들을 정리한다.
        this.mainContainer = mainContainer;
        this.editorContainer = document.createElement('div');
        this.editorContainer.id = 'IgmeEditor';
        this.editorContainer.style = `display: block; width: 100%; height: 100%; padding: 0; margin: 0;`;
        this.previewContainer = document.createElement('div');
        this.previewContainer.id = 'IgmePreview';
        this.previewContainer.style = `display: none; width: 100%; height: 100%; padding: 0; margin: 0;`;
        this.mainContainer.appendChild(this.editorContainer);
        this.mainContainer.appendChild(this.previewContainer);

        // 마크다운 모듈을 설정
        this.md = new MarkdownIt({
            html: true,         // HTML을 허용
            breaks: true,       // \n을 <br>로 변환
            linkify: true,      // URL 같은 문자열을 링크로 변환
            typographer: true,  // 일부 관행적 문자열 (C), (R) 등을 특수문자로 치환
            xhtmlOut: false     // <br>을 <br /> 과 같이 변환. full compatibility를 위한 것으로 불필요 
        })
            .use(mdiFootNote)
            .use(mdiAbbr)
            .use(mdiMark)
            .use(mdiDeflist)
            .use(mdiTasks, { enabled: true })
            .use(mdiSup)
            .use(mdiSub)
            .use(markdownItImageSize)
            .use(markdownItInjectLineNumbers);

        // $-$, $$-$$를 \(-\), \[-\]과 같은 식으로 바꾼다. (pandoc math규정을 따름)
        if (typeof MathJax !== "undefined") {
            this.md.use(markdownitMathjax());
        }
        //

        // 브로드캐스팅 채널 설정
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

        // Codemirror theme 설정
        const fixedHeightEditor = EditorView.theme({
            "&.cm-editor": { height: "100%" },
            ".cm-scroller": { overflow: "auto" }
        });

        // 이벤트 분배기(ViewUpdate class 참조)
        let eventHandler = EditorView.updateListener.of((v) => {
            // 내용이 변경된 경우
            if (v.docChanged) this.onDocumentChanged();
            // 화면의 크기가 바뀌는 경우
            //else if (v.geometryChanged) { }
        });

        // 스크롤 이벤트는 여기에서 분배
        let domeventhandler = EditorView.domEventHandlers({
            //scroll(event, view) { self.onScroll(event, view, self) }
        });

        // CodeMirror 초기화
        this.state = EditorState.create({
            doc: initialContent,
            extensions: [
                oneDark,
                fixedHeightEditor,
                EditorView.lineWrapping,
                (typeof MathJax !== "undefined") ? 
                    markdown({extensions: [...GFM, Superscript, Subscript, Emoji, mdpTexInline, mdpTexBlock, mdpMark, mdpFootnote] }):
                    markdown({extensions: [...GFM, Superscript, Subscript, Emoji, mdpMark, mdpFootnote] }),
                eventHandler,
                domeventhandler,
                lineNumbers(),
                //highlightActiveLineGutter(),
                history(),
                //drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                rectangularSelection(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightSelectionMatches(),
                //markdown({ base: markdownLanguage }),
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...searchKeymap,
                    ...historyKeymap,
                    ...foldKeymap,
                    ...completionKeymap,
                    ...lintKeymap
                ]),
                updateListener
            ]
        });

        this.editor = new EditorView({
            state: this.state,
            parent: this.editorContainer
        });

        this.igmePreview = new IgmePreview();

        this.updatePreview();
        this.addEventListeners();
    }

    // 에디터 이벤트 리스너 추가
    addEventListeners() {
        this.editorContainer.addEventListener("keydown", (e) => {
            let keyCode = e.key || e.keyCode;
            // Detect if the platform is macOS
            const isMac = /Mac/i.test(navigator.userAgent);
            const isAlt = e.altKey && !e.metaKey; // Alt key without Cmd key
            const isCmd = e.metaKey && !e.altKey; // Cmd key without Alt key

            // Preview on/off: Alt + ` or Cmd + \
            if ((!isMac && isAlt && keyCode === '`') || (isMac && isCmd && keyCode === '\\')) {
                this.igmePreview.togglePreview(this);
                // preview 직후에 미처 에디터가 다 전환되지 않은 상태에서 리턴되므로
                // 조금 여유를 두고 preview를 스크롤한다. (TODO: 나중에 아예 확실한 대책 마련 필요)
                //if (self.previewEnabled) {
                // 단축키로 전환시에는 대개 커서 위치에 작업중인 경우가 많아 preview를 커서 쪽으로 맞추는 것이 좋다.
                //setTimeout(self.scrollPreviewAsTextareaCursor, 200, self);
                //}
            }
        });
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

        // preview에도 반영한다.
        if(this.previewEnabled) this.igmePreview.renderMarkdownTextToPreview(this);

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
        this.editor.dispatch(move);*/
    }

    // 글자 입력 등으로 본문의 내용이 변경된 경우
    onDocumentChanged() {
        var self = this;
        if (self.previewEnabled) {
            self.onPasteInput = true;// 스크롤 이벤트가 처리되지 않고 키에서 스크롤 하도록... 
            // 여러 번 호출되면 시스템 부하도 많이 생기고 이상동작할 수 있으므로 타이머를 걸어서 간격을 두어 처리한다.
            if (self.previewTimer != null) clearTimeout(self.previewTimer);
            self.previewTimer = setTimeout((self) => {
                self.igmePreview.renderMarkdownTextToPreview(self);
                //self.textareaCount.updateEditorSize();
                //self.textareaCount.setText($(self.igme_editor).val());
                // 입력이 많을 때에는 지연되어 스크롤에 현상태가 잘 반영이 안된다. 
                // 그래서 스크롤이 여기에 맞추어 되도록 방법을 강구한다.
                //self.scrollPreviewAsTextareaCursor(self);
                self.onPasteInput = false;// 스크롤 이벤트가 처리하지 않고 키에서 스크롤 하도록...
            }, 200, self);
        }

        // autosave가 설정되어 있으면 2초 뒤에 자동저장한다.
        //if(self.autosaveFlag === true) {
        //    if(self.autosaveTime !== null) clearTimeout(self.autosaveTimer);
        //    self.autosaveTimer = setTimeout(self.contentSave, 2000, self);
        //} 
    }
}
