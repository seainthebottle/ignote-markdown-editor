
import { oneDark } from "@codemirror/theme-one-dark";
import { nord } from "cm6-theme-nord";
import {
    EditorView, keymap, highlightActiveLine, dropCursor,
    rectangularSelection, crosshairCursor,
    lineNumbers
} from "@codemirror/view"
import { Compartment, StateEffect, EditorState, EditorSelection } from "@codemirror/state"
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldKeymap } from "@codemirror/language"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { lintKeymap } from "@codemirror/lint"
import { markdown } from "@codemirror/lang-markdown";
import { GFM, Superscript, Subscript, Emoji } from "@lezer/markdown";
import { mdpTexInline, mdpTexBlock, mdpMark, mdpFootnote } from "./lib/additional-markdown-parser";

import MarkdownIt from "markdown-it";
import mdiFootNote from "markdown-it-footnote";
import mdiAbbr from "markdown-it-abbr";
import mdiMark from "markdown-it-mark";
import mdiDeflist from "markdown-it-deflist";
import mdiTasks from "markdown-it-tasks";
import mdiSup from "markdown-it-sup";
import mdiSub from "markdown-it-sub";
import markdownItImageSize from "./lib/markdown-it-imgsize";
import markdownitMathjax from "./lib/markdown-it-mathjax";
import markdownItInjectLineNumbers from "./lib/markdown-it-inject-linenumbers";
import markdownItHashtag from "./lib/markdown-it-hashtag";

import IgmePreview from "./lib/igme-preview";
import { getCustomTheme } from "./lib/theme-custom";


import HtmlSanitizer from "./lib/htmlSanitizer";

// StateEffect를 전역에서 정의 (클래스 외부에서 한 번만 선언)
const IgnoreUpdateEffect = StateEffect.define();

export default class IgnoteMarkdownEditor {
    constructor(mainContainerId, initialContent = "") {

        this.previewEnabled = false;
        this.resizeTimer = null;
        this.previewTimer = null;
        this.mathJaxTimer = null;
        this.autosaveTimer = null;
        this.autosaveFlag = false;

        this.mouseClientX = null;
        this.mouseClientY = null;

        this.arrowKeyDown = false;
        this.onPasteInput = false;


        // 컨테이너들을 정리한다.
        this.mainContainer = document.getElementById(mainContainerId);
        if(this.mainContainer == null) return;
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
            .use(markdownItInjectLineNumbers)
            .use(markdownItHashtag);

        // $-$, $$-$$를 \(-\), \[-\]과 같은 식으로 바꾼다. (pandoc math규정을 따름)
        if (typeof MathJax !== "undefined") {
            this.md.use(markdownitMathjax());
        }

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
            scroll: (event, view) => { this.onScroll(event, view) }
        });

        var themeCompartment = new Compartment();
        var theme = {
            style: {
                foreground: "#f4f4f4",
                highlightBackground: "#222222",
                gutterBackground: "#161b22"
            },
            highlight: {
                keyword: { color: "#c678dd" },
                strong: { fontWeight: "bold" },
                emphasis: { fontStyle: "italic" },
                strikethrough: { textDecoration: "line-through" },
                link: { color: "#7d8799", textDecoration: "underline" },
                heading: { fontWeight: "bold", color: "#e06c75" },
                processingInstruction: { color: "#98c379" },
                tex: { color: "#61afef" }
            },
            isDark: true
        }
        let baseTheme = getCustomTheme(theme);

        const extensions = [
            themeCompartment.of(baseTheme),
            fixedHeightEditor,
            EditorView.lineWrapping,
            (typeof MathJax !== "undefined") ?
                markdown({ extensions: [...GFM, Superscript, Subscript, Emoji, mdpMark, mdpFootnote, mdpTexInline, mdpTexBlock] })
                : markdown({ extensions: [...GFM, Superscript, Subscript, Emoji, mdpMark, mdpFootnote] }),
            eventHandler,
            domeventhandler,
            lineNumbers(),
            //highlightActiveLineGutter(),
            history(),
            //drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
        ].filter(Boolean);

        // CodeMirror 초기화
        this.state = EditorState.create({
            doc: initialContent,
            extensions
        });

        this.mainEditor = new EditorView({
            state: this.state,
            parent: this.editorContainer
        });

        this.igmePreview = new IgmePreview(this);

        this.mainEditorElement = document.querySelector("#IgmeEditor .cm-editor");

        this.igmePreview.renderMarkdownTextToPreview();
        this.addEventListeners();
    }

    // 에디터 이벤트 리스너 추가
    addEventListeners() {
        this.mainEditorElement.addEventListener("keydown", (e) => {
            let keyCode = e.key || e.keyCode;
            // Detect if the platform is macOS
            const isMac = /Mac/i.test(navigator.userAgent);

            // Preview on/off: Alt + ` or Cmd + \
            if ((!isMac && e.altKey && keyCode === '`') || (isMac && e.metaKey && keyCode === '\\')) {
                e.preventDefault();
                this.igmePreview.togglePreview();
                // preview 직후에 미처 에디터가 다 전환되지 않은 상태에서 리턴되므로
                // 조금 여유를 두고 preview를 스크롤한다. (TODO: 나중에 아예 확실한 대책 마련 필요)
                if (this.previewEnabled) {
                    // 단축키로 전환시에는 대개 커서 위치에 작업중인 경우가 많아 preview를 커서 쪽으로 맞추는 것이 좋다.
                    //setTimeout(this.scrollPreviewAsTextareaCursor, 200, this);
                }
            }
        });

        // 편집창에서 마우스 클릭될 때 preview 위치도 조정해준다.
        // TODO: 편집창의 맨 윗줄이 자꾸 변동되므로 일관성 있게 유지되게 해 준다.
        this.mainEditorElement.addEventListener("click", (e) => {
            //this.getHtmlData()
            // preview가 열려 있을 때만 조정한다.
            // console.log('click', this.previewEnabled)
            if (this.previewEnabled) this.scrollPreviewAsTextareaCursor(this);
        });

        // // 키 이벤트 처리기로 추후에 단축키 설정에 통합시켜야 한다.
        this.mainEditorElement.addEventListener("keydown", (e) => {
            const isMac = /Mac/i.test(navigator.userAgent);
            let keyCode = e.key || e.keyCode;
            // 탭키가 눌러지면 편집창을 벗어나지 않고 탭을 넣을 수 있도록 해 준다.
            if (keyCode === "Tab") {
                // console.log(this.mainContainer, this.insertMarkdownText)
                e.preventDefault();
                this.insertMarkdownText("\t");
                return false;
            }

            // 방향키로 스크롤될 때에는 preview 스크롤이 스크롤 이벤트에서 처리되지 않고 keyup 이벤트로 처리되게 한다.
            else if (keyCode === "PageUp" || keyCode === "PageDown" ||
                keyCode === "ArrowUp" || keyCode === "ArrowDown" || keyCode === "ArrowLeft" || keyCode === "ArrowRight") this.arrowKeyDown = true;

            // 엔터키를 입력하면 키입력에 맞추어 스크롤 되게 한다.
            else if (keyCode === "Enter") this.onPasteInput = true;
        });

        // 키보드로 커서 이동시 스크롤도 함께 되도록 한다.
        this.mainEditorElement.addEventListener("keyup", (e) => {
            let keyCode = e.key || e.keyCode;
            if (keyCode === "PageUp" || keyCode === "PageDown" ||
                keyCode === "ArrowUp" || keyCode === "ArrowDown" || keyCode === "ArrowLeft" || keyCode === "ArrowRight") {//} ||
                //(keyCode == "Enter" && this.enterLastLine)) { // 엔터로 내용이 바뀌면 이에 맞추어 업데이트 되는데 필요할 지...
                this.arrowKeyDown = false;
                this.enterLastLine = false;
                if (this.previewEnabled) this.scrollPreviewAsTextareaCursor(this);
            }
        });

        // 스크롤이 더 되지는 않으나 휠을 돌릴 때 처리를 한다.
        //this.mainEditor.session.on("changeScrollTop", // 이거는 더 스크롤 안되면 호출도 안된다.
        this.mainEditorElement.addEventListener("mousewheel", (e) => {
            //console.log(`mousemove wh cli x:${e.clientX} y:${e.clientY}`)
            this.mouseClientX = e.clientX;
            this.mouseClientY = e.clientY;
            // 키보드가 움직여 스크롤할때는 따로 처리하므로 휠만 처리한다.
            if (this.previewEnabled) {
                var el = this.mainEditorElement;
                var clientBottom = this.mainEditorElement.getBoundingClientRect().top + parseFloat(window.getComputedStyle(this.mainEditorElement).height);
                //console.log('client - ', this.mainEditorElement.getBoundingClientRect().top, clientBottom)
                var docBottom = this.mainEditor.documentTop + this.mainEditor.contentHeight;
                //console.log(docBottom)
                // 첫 행에 이르면 preview도 첫 행으로 보낸다.
                if (this.mainEditor.documentTop + this.mainEditor.defaultLineHeight > this.mainEditorElement.getBoundingClientRect().top)
                    this.igmePreview.movePreviewPosition(-2);
                // 마지막 행에 이르면 preview도 맨 끝으로 보낸다.
                if (docBottom < clientBottom + this.mainEditor.defaultLineHeight) this.igmePreview.movePreviewPosition(-1);
            }
        }, { passive: true }
        );

        // 마우스 이동시 위치를 기억했다가 스크롤 시 참조한다.
        this.mainEditorElement.addEventListener("mousemove", (e) => {
            //console.log(`mousemove cli x:${e.clientX} y:${e.clientY}`)
            this.mouseClientX = e.clientX;
            this.mouseClientY = e.clientY;
            //if (this.mainEditor)
            //    this.mainEditor.posAtCoords({ x: this.clientX, y: this.clientY }, false);
        });

        // // dark/light 모드에 따라 자동으로 바뀔 수 있도록 해 준다.
        // window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        //     var newDefaultTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)?rmdeDark:rmdeLight;
        //     if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
        //         if(typeof EditorSettings !== 'undefined' && typeof EditorSettings.darkTheme != 'undefined')
        //             newDefaultTheme = getCustomeTheme(window[EditorSettings.darkTheme]); 
        //         else newDefaultTheme = rmdeDark;
        //     }
        //     else {
        //         if(typeof EditorSettings !== 'undefined' && typeof EditorSettings.lightTheme != 'undefined')
        //             newDefaultTheme = getCustomeTheme(window[EditorSettings.lightTheme]); 
        //         else newDefaultTheme = rmdeLight;
        //     }
        //     this.mainEditor.dispatch({effects: [themeCompartment.reconfigure([newDefaultTheme])]});
        // });
    }

    // 현재 커서 위치로 preview를 스크롤한다.
    scrollPreviewAsTextareaCursor(self) {
        //console.log('scrollPreviewAsTextareaCursor')
        // TODO: 커서위치가 없을 경우 대비도 해야 한다.
        // console.log('scrollPreviewAsTextareaCursor')
        var selection = this.mainEditor.state.selection;
        if (typeof selection === 'undefined') return false;
        //var curFrom = selection.main.from;
        var curTo = selection.main.to;

        if (curTo === 0) this.igmePreview.movePreviewPosition(-2, false);
        else if (curTo === this.mainEditor.state.doc.length) this.igmePreview.movePreviewPosition(-1, false);
        else this.igmePreview.movePreviewPositionWithEditorPosition(this.mainEditor.state.doc.lineAt(curTo).number - 1);
        return true;
    }

    /**
      * 에디터를 삭제한다.
      */
    destroy() {
        this.mainEditor.destroy();
        this.mainContainer.innerHTML = "";
    }

    /** 
     * 에디터에 포커스를 맞춰준다. 
     * */
    focus() {
        this.mainEditor.focus();
    }

    /**
     * 에디터 옆에 프리뷰 표시여부를 변경한다.
     * @param {*} mode 
     */
    togglePreview(mode) {
        this.igmePreview.togglePreview(mode);
    }

    /**
     * Markdown 미리보기 업데이트
     */
    updatePreview() {
        this.igmePreview.renderMarkdownTextToPreview();
    }

    /**
     * 편집한 Markdown 가져오기
     * @returns {string} Markdown 문서
     */
    getValue() {
        return this.mainEditor.state.doc.toString();
    }

    /**
     * Markdown으로 편집된 문서를 HTML로 변환하여 가져온다.
     * @returns {string} HTML 문서
     */
    getOutputValue() {
        return this.igmePreview.convertImgLinks(HtmlSanitizer.SanitizeHtml(this.md.render(this.mainEditor.state.doc.toString())));
    }

    /**
     * Markdown내 검출된 해시태그를 리턴한다.
     * @returns 해시태그 리스트 ['첫번째태그', '두번째태그']
     */
    getHashtags() {
        return this.md.getFoundHashtags();
    }

    /**
     * Markdown 설정하기
     */
    setValue(content) {
        this.mainEditor.dispatch({
            changes: { from: 0, to: this.mainEditor.state.doc.length, insert: content },
            effects: IgnoreUpdateEffect.of(null) // StateEffect 추가(업데이트 이벤트 발생을 막기 위해)
        });
        this.updatePreview();
    }

    /** 
     * Insert markdown text into the editor at current cursor position
     */
    insertMarkdownText(markdownText) {
        let selection = this.mainEditor.state.selection;
        let curFrom = selection.main.from;
        let curTo = selection.main.to;
        let newCursorPosition = curFrom + markdownText.length; // 커서 위치 조정

        // 트랜잭션 생성 후 dispatch 실행
        this.mainEditor.dispatch({
            changes: { from: curFrom, to: curTo, insert: markdownText },
            selection: { anchor: newCursorPosition, head: newCursorPosition }
        });

        // preview에도 반영한다.
        if (this.previewEnabled) this.igmePreview.renderMarkdownTextToPreview();

        /*// 현재 커서 위치에 덮어쓰기를 한다.
        var selection = this.state.selection;
        var curFrom = selection.main.from;
        var curTo = selection.main.to;
        var update = this.state.update(
            { changes: { from: curFrom, to: curTo, insert: markdownText } },
            { selection: { anchor: newCursorPosition, head: newCursorPosition } }
        );*/

        // 커서를 새로 교체한 text의 끝에 위치시킨다. 그래야 순서가 올바르게 삽입된다.
        //var newCursorPosition = curTo + markdownText.length;
        //var move = { selection: { anchor: newCursorPosition, head: newCursorPosition } };

        // 위의 transaction 들을 반영한다.
        //this.editor.dispatch(update);
        //this.editor.dispatch(move);
    }

    /**
     * 글자 입력 등으로 본문의 내용이 변경된 경우
     */
    onDocumentChanged() {
        if (this.previewEnabled) {
            this.onPasteInput = true;// 스크롤 이벤트가 처리되지 않고 키에서 스크롤 하도록... 
            // 여러 번 호출되면 시스템 부하도 많이 생기고 이상동작할 수 있으므로 타이머를 걸어서 간격을 두어 처리한다.
            if (this.previewTimer != null) clearTimeout(this.previewTimer);
            this.previewTimer = setTimeout(() => {
                this.igmePreview.renderMarkdownTextToPreview();
                // 입력이 많을 때에는 지연되어 스크롤에 현상태가 잘 반영이 안된다. 
                // 그래서 스크롤이 여기에 맞추어 되도록 방법을 강구한다.
                //this.scrollPreviewAsTextareaCursor(this);
                this.onPasteInput = false;// 스크롤 이벤트가 처리하지 않고 키에서 스크롤 하도록...
            }, 200, this);
        }
    }

    /**
     * 지정된 좌표에서의 행(0-based)을 구한다.
     */
    getRowFromCoords(x, y) {
        var pos = this.mainEditor.posAtCoords({ x, y }, false); // 여기의 좌표는 브라우저내 화면의 좌표기준이다.
        return this.mainEditor.state.doc.lineAt(pos).number - 1;
    }

    /**
     * 스크롤 이벤트를 처리한다.
     */
    onScroll(event, view) {
        // preview가 열려 있을 때만 조정한다.
        const scrollTop = document.documentElement.scrollTop || window.pageYOffset;
        //console.log(this.documentScrolled, documentScrolled, this.mainContainer.style.display);
        if (!this.onPasteInput && !this.arrowKeyDown // 키관련 스크롤은 따로 처리되도록..
            && this.previewEnabled) {
            const line_no = this.getRowFromCoords(this.mouseClientX, this.mouseClientY - scrollTop, this);
            //console.log(`line_no: ${line_no}, x:${this.mouseClientX}, y: ${this.mouseClientY}, scrollTop: ${scrollTop}`)
            this.igmePreview.movePreviewPositionWithEditorPosition(line_no);
            //this.documentScrolled = documentScrolled;
        }
    }

    /**
     * 현재 선택된 범위 정보를 반환한다.
     * @returns { from: number, to: number, anchor: number, head: number }
     */
    getSelectionRange() {
        const sel = this.mainEditor.state.selection.main;
        return { from: sel.from, to: sel.to, anchor: sel.anchor, head: sel.head };
    }
}
