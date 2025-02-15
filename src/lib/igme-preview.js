/**
 * RhymixMarkdownEditor의 preview 관리 subclass
 */

import HtmlSanitizer from "./htmlSanitizer";
import diff from "./changeDiff";

class IgmePreview {
    constructor() {

    }

    /**
     * 에디터의 지정된 행의 블록의 브라우저 내 y좌표를 pixel 단위로 리턴한다.  
     * @param {*} textLineNo 
     * @param {*} self 
     * @returns 
     */
    getDocumentYFromLineNo(textLineNo, self) {
        var lineInfo = self.mainEditor.state.doc.line(textLineNo + 1);
        var blockInfo = self.mainEditor.lineBlockAt(lineInfo.from);
        return blockInfo.top;
    }

    /**
     *  주어진 행은 preview상에는 등록되어 있지 않을 수 있어 실제로 preview에 행이 등록되어 있는 textarea상의 행을 찾는다.
     */
    getEffectiveLineNo(textLineNo) {
        // 해당 textLineNo에 해당하는 preview HTML이 없으면 나올 때까지 textLineNo를 줄여가며 찾는다. 
        for (var effTextLineNo = textLineNo;
            !document.querySelector(`#IgmePreview [data-source-line="${effTextLineNo}"]`)?.getBoundingClientRect() 
                && effTextLineNo >= 0;
            effTextLineNo--);
        //console.log("effectiveLineNo", effTextLineNo)
        return effTextLineNo;
    }

    /**
     * 특정 행번호에 해당하는 preview HTML을 preview 상단으로 이동한다.
     */
    movePreviewPositionWithEditorPosition(textLineNo, self) {
        // 첫줄과 끝줄은 따로 처리한다.
        if (textLineNo === -2 || textLineNo === -1) this.movePreviewPosition(self, textLineNo);
        else {
            var effectiveTextLineNo = this.getEffectiveLineNo(textLineNo);
            // 앞 부분에 effectiveLineNo가 없으면 맨 앞으로 스크롤한다.
            if(effectiveTextLineNo == -1) this.movePreviewPosition(self, -2);
            else {
                // 해당 행이 위치하는 Y 좌표를 구해 거기서 에디터 상단 Y를 뺀 만큼이 스크롤량이다.
                let documentY = this.getDocumentYFromLineNo(effectiveTextLineNo, self); // 지정된 행이 맨 윗줄에서 얼마나 떨어져 있느냐(픽셀단위)
                let documentScrolled = self.mainEditor.scrollDOM.scrollTop; // 에디터가 얼마나 스크롤되어 있느냐
                this.movePreviewPosition(self, effectiveTextLineNo, false, documentY - documentScrolled);
            }
        }
    }


    /** 
     * 지정된 markdown 행번호에 해당하는 preview HTML을 preview 상단으로 이동한다.
     */
    movePreviewPosition(
        self,
        linenum,
        animate = false,
        reposToEditorTarget = 0, // 에디트중인 위치로 preview도 위치 조정 
    ) {
        //console.log(`movePreviewPosition linenum:${linenum}, animate:${animate}, slideDown: ${slideDown}`)
        const previewContainer = document.getElementById('IgmePreview');
        // 끝줄로 가면 끝줄 처리를 한다.
        if (linenum == -1) {
            let scrollHeight = previewContainer.scrollHeight;
            this.scrollAnimate(previewContainer, scrollHeight);
            return;
        }
        // 첫줄인 경우
        else if (linenum == -2) {
            this.scrollAnimate(previewContainer, 0);
            return;
        }

        // 해당 행에 맞는 preview 위치로 preview 텍스트를 옮긴다.
        const targetElement = document.querySelector(`#IgmePreview [data-source-line="${linenum}"]`);
        //console.log(linenum, targetElement)
        let offset = targetElement?.getBoundingClientRect(); // document 상 위치
        // TODO: 정의되어 있지 않을 경우 화면전환시 엉뚱한 곳으로 가는 경우가 있어 보정이 필요하다.
        // --> 그 윗줄끼리라도 맞춘다.
        if (!offset) return; 
        // preview 최상단에서 현재 markdown에서 찍은 문장의 HTML 파트의 윗부분과의 거리
        let distance = offset.top - previewContainer.getBoundingClientRect()?.top; 

        // 첫번째 줄이 정의되어 있지 않다면 맨 앞으로 스크롤하고 그렇지 않으면 적절히 계산해서 스크롤한다.
        let scrollval = // 첫 행을 document 기준 어느 Y좌표까지 끌어올릴지
            previewContainer.scrollTop // preview에서 스크롤바로 이미 스크롤되어 있는 양
            + distance // 현재 목적행을 화면 맨 위로 옮기기 위해 끌어올릴 분량
            - reposToEditorTarget; // 끌어내릴 분량
        if (scrollval < 0) scrollval = 0;

        this.scrollAnimate(previewContainer, scrollval);

        // 선택 부위를 하이라이트한다.
        //if (animate) {
        //    $(`[data-source-line="${linenum}"]`).animate({ opacity: 0.4, }, 400);
        //    $(`[data-source-line="${linenum}"]`).animate({ opacity: 1.0, }, 400);
        //}
    }

    /**
     *  마크다운을 변환한다.
     */
    convertMarkdownToHtml(self, markdownText) {
        return HtmlSanitizer.SanitizeHtml(self.md.render(markdownText));
    }

    /**
     * MathJax를 포함한 마크다운을 변환한다.
     */
    renderMarkdownTextToPreview(self) {
        //console.log(self)
        if (self == null) self = this;

        // 변환한다.
        let convertedHTMLText = HtmlSanitizer.SanitizeHtml(self.getOutputValue());
        let preview_element = document.getElementById('IgmePreview');

        // 이전 DOM(preview_element)과 비교하여 바뀐 부분만 반영되도록 한다.
        diff.changeDiff(diff.stringToHTML(convertedHTMLText), preview_element);
        if (typeof window?.MathJax?.typeset !== "undefined") {
            window.MathJax.texReset();
            window.MathJax.typesetPromise([preview_element]).then(() => { })
                .catch((err) => { console.log(err.message) });
        }
        self.previewTimer = null;
    }

    /**
     * Preview를 전환한다.
     * @param {*} self - mother class의 this 
     */
    togglePreview(self) {
        const main_container = document.getElementById('PageEditorContainer');
        const editor_container = document.getElementById('IgmeEditor');
        const preview_container = document.getElementById('IgmePreview');
        preview_container.classList.add('page-viewer-element');
        let preview_display = preview_container.style.display;
        let preview_float = preview_container.style.float;

        let total_height = window.getComputedStyle(main_container).height;
        let editor_height = null;

        // 이전에 preview가 없었던 경우
        if (preview_display == "none") {
            editor_height = total_height;

            editor_container.style.width = '50%';
            editor_container.style.float = 'left';
            editor_container.style.height = editor_height + "px";

            preview_container.style.display = 'block';
            preview_container.style.width = '50%';
            preview_container.style.float = 'right';
            preview_container.style.height = editor_height + "px";

            this.renderMarkdownTextToPreview(self);
            self.previewEnabled = true;
        } /*// 아래쪽으로 preview를 넣는 것은 당분간 보류
            else if (preview_display == "block" && preview_float == "right") {
            editor_height = (main_container.height()! - 60) / 2;

            editor_container.style.width", "100%");
            editor_container.style.float", "none");
            editor_container.style.height = editor_height + "px";
            editor_container.style.height = editor_height + "px";

            $(self.rmde_preview).show();
            $(self.rmde_preview_title).show();
            preview_container.style.width", "100%");
            preview_container.style.float", "none");
            preview_container.style.height", editor_height + 30);
            $(self.rmde_preview_main).css("height", editor_container.style.height"));
            //preview_container.style.height", editor_container.style.height"));
            main_container.css("height",
                $(self.rmde_toolbar).height()! + $(self.rmde_editor).height()! + $(self.rmde_preview).height()! + 4 // border에 따른 오차보정
            );

            this.renderMarkdownTextToPreview(self);
            self.previewEnabled = true;
        }*/ else {
            editor_height = total_height;
            preview_container.style.display = 'none';
            editor_container.style.height = editor_height + 'px';
            editor_container.style.width = '100%';

            self.previewEnabled = false;
        }
    }

    /**
     * 지정한만큰 element를 스크롤한다.
     * @param {*} element 
     * @param {*} targetScrollTop 
     * @param {*} duration 
     * @returns 
     */
    scrollAnimate(element, targetScrollTop = 0, duration = 100) {
        /*if (!element) return;

        // 기존 애니메이션 중단
        if (element.animationFrame) {
            cancelAnimationFrame(element.animationFrame);
        }

        const start = element.scrollTop;
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1); // 0 ~ 1 범위

            // Linear easing 적용*/
            //element.scrollTop = start + (targetScrollTop - start) * progress;
            element.scrollTop = targetScrollTop;

            /*if (progress < 1) {
                element.animationFrame = requestAnimationFrame(animateScroll);
            }
        }

        requestAnimationFrame(animateScroll);*/
    }


}

export default IgmePreview;