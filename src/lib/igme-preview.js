/**
 * RhymixMarkdownEditor의 preview 관리 subclass
 */

import HtmlSanitizer from "./htmlSanitizer";
import diff from "./changeDiff";

class IgmePreview {
    constructor(parent) {
        this.parent = parent;
        this.main_container = document.getElementById('PageEditorContainer');
        this.editor_container = document.getElementById('IgmeEditor');
        this.preview_container = document.getElementById('IgmePreview');
    }

    /**
     * 에디터의 지정된 행의 블록의 브라우저 내 y좌표를 pixel 단위로 리턴한다.  
     * @param {*} textLineNo 
     * @param {*} self 
     * @returns y좌표
     */
    getDocumentYFromLineNo(textLineNo, self) {
        var lineInfo = self.mainEditor.state.doc.line(textLineNo + 1);
        var blockInfo = self.mainEditor.lineBlockAt(lineInfo.from);
        return blockInfo.top;
    }

    /**
     * 주어진 행은 preview상에는 등록되어 있지 않을 수 있어 실제로 preview에 행이 등록되어 있는 textarea상의 행을 찾는다.
     * @param {number} textLineNo
     */
    getEffectiveLineNo(textLineNo) {
        // 해당 textLineNo에 해당하는 preview HTML이 없으면 나올 때까지 textLineNo를 줄여가며 찾는다. 
        for (var effTextLineNo = textLineNo;
            !document.querySelector(`#IgmePreview [data-source-line="${effTextLineNo}"]`)?.getBoundingClientRect()
            && effTextLineNo >= 0;
            effTextLineNo--);
        return effTextLineNo;
    }

    /**
     * 특정 행번호에 해당하는 preview HTML을 preview 상단으로 이동한다.
     * @param {number} textLineNo
     */
    movePreviewPositionWithEditorPosition(textLineNo) {
        //console.log('movePreviewPositionWithEditorPosition')
        // 첫줄과 끝줄은 따로 처리한다.
        if (textLineNo === -2 || textLineNo === -1) this.movePreviewPosition(textLineNo);
        else {
            var effectiveTextLineNo = this.getEffectiveLineNo(textLineNo);
            // 앞 부분에 effectiveLineNo가 없으면 맨 앞으로 스크롤한다.
            if (effectiveTextLineNo == -1) this.movePreviewPosition(-2);
            else {
                // 해당 행이 위치하는 Y 좌표를 구해 거기서 에디터 상단 Y를 뺀 만큼이 스크롤량이다.
                let documentY = this.getDocumentYFromLineNo(effectiveTextLineNo, this.parent); // 지정된 행이 맨 윗줄에서 얼마나 떨어져 있느냐(픽셀단위)
                let documentScrolled = this.parent.mainEditor.scrollDOM.scrollTop; // 에디터가 얼마나 스크롤되어 있느냐
                this.movePreviewPosition(effectiveTextLineNo, false, documentY - documentScrolled);
            }
        }
    }


    /** 
     * 지정된 markdown 행번호에 해당하는 preview HTML을 preview 상단으로 이동한다.
     * @param {number} linenum 
     * @param {boolean} [animate=false] 
     * @param {number} [reposToEditorTarget=0] 에디트중인 위치로 preview도 동등하게 위치를 조정하기 위해 
     */
    movePreviewPosition(
        linenum,
        animate = false,
        reposToEditorTarget = 0,
    ) {
        //console.log('movePreviewPosition')
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
        let offset = targetElement?.getBoundingClientRect(); // document 상 위치
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
     * HTML 문자열 내 <p> 태그로 감싸진 <img> 태그를 변환
     * - .pptx/.pdf 파일은 <iframe>으로 변환하고 <p>는 <div>로 변경
     * - 기타 파일은 <p> 및 <img> 모두 원래 상태로 보존
     * - 모든 속성(class, id, style 등) 보존
     *
     * @param {string} htmlString - 변환할 HTML 문자열
     * @returns {string} - 변환된 HTML 문자열
     */
    convertImgLinks(htmlString) {
        return htmlString.replace(
            /<p([^>]*)>\s*(<img\s+([^>]*?)src=["']([^"']+\.(pptx|pdf|[a-zA-Z0-9]+))["']([^>]*)>)\s*<\/p>/gi,
            (match, pAttributes, imgTag, beforeSrc, fileUrl, fileType, afterSrc) => {
                // width/height 속성 제거 및 나머지 속성 보존
                const cleanedAttributes = `${beforeSrc} ${afterSrc}`
                    .replace(/\s*(width|height)=["'][^"']*["']/gi, "")
                    .trim();

                if (fileType === 'pptx') {
                    // .pptx 파일 → Microsoft Office Online Viewer
                    // return `<div ${pAttributes} style="height:100%">
                    return `<div class="external-document" style="height:100%">
                            <iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}"
                                    ${cleanedAttributes} width="100%" height="99%" frameborder="0"></iframe>
                        </div>`;
                } else if (fileType === 'pdf') {
                    // .pdf 파일 → 브라우저 기본 PDF 뷰어
                    // return `<div ${pAttributes} style="height:100%">
                    return `<div class="external-document" style="height:100%">
                            <iframe src="${fileUrl}" ${cleanedAttributes} width="100%" height="100%" frameborder="0"></iframe>
                        </div>`;
                } else {
                    // 기타 파일은 <p> 및 <img> 모두 원래 상태로 보존
                    return match;
                }
            }
        );
    }

    /**
     *  마크다운을 변환한다.
     * @param {string} markdownText 
     */
    convertMarkdownToHtml(markdownText) {
        return this.convertImgLinks(HtmlSanitizer.SanitizeHtml(this.parent.md.render(markdownText)));
        //return this.parent.md.render(markdownText);
    }

    /**
     * MathJax를 포함한 마크다운을 HTML로 변환해 preview에 표시한다 
     */
    renderMarkdownTextToPreview() {
        //console.log('renderMarkdownTextToPreview')
        // 변환한다.
        let convertedHTMLText = this.convertImgLinks(HtmlSanitizer.SanitizeHtml(this.parent.getOutputValue()));
        //let convertedHTMLText = this.parent.getOutputValue();
        let preview_element = document.getElementById('IgmePreview');

        // 이전 DOM(preview_element)과 비교하여 바뀐 부분만 반영되도록 한다.
        diff.changeDiff(diff.stringToHTML(convertedHTMLText), preview_element);
        if (typeof window?.MathJax?.typeset !== "undefined") {
            window.MathJax.texReset();
            window.MathJax.typesetPromise([preview_element]).then(() => { })
                .catch((err) => { console.log(err.message) });
        }
        this.parent.previewTimer = null;
    }

    /**
     * Preview를 전환한다.
     * @param {'toggle'|'clear'|'preview'} mode - toggle: 기본값 - 번갈아서 / clear: preview 없음 / preview: preview 병행
     */
    togglePreview(mode = 'toggle') {
        //console.log(`togglePreview ${mode}`)
        const main_container = document.getElementById('PageEditorContainer');
        const editor_container = document.getElementById('IgmeEditor');
        const preview_container = document.getElementById('IgmePreview');
        preview_container.classList.add('page-viewer-element');
        let preview_display = preview_container.style.display;
        let preview_float = preview_container.style.float;

        let total_height = window.getComputedStyle(main_container).height;
        let editor_height = null;

        // 이전에 preview가 없었던 경우 preview를 만든다.
        if ((mode == 'toggle' && preview_display == "none") || mode == "preview") {
            //console.log('preview mode')
            editor_height = total_height;

            editor_container.style.width = '50%';
            editor_container.style.float = 'left';
            editor_container.style.height = editor_height + "px";

            preview_container.style.display = 'block';
            preview_container.style.width = '50%';
            preview_container.style.float = 'right';
            preview_container.style.height = editor_height + "px";

            this.renderMarkdownTextToPreview();
            this.parent.previewEnabled = true;
        } else {
            //console.log('clear mode')
            editor_height = total_height;
            preview_container.style.display = 'none';
            editor_container.style.height = editor_height + 'px';
            editor_container.style.width = '100%';

            this.parent.previewEnabled = false;
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
        element.scrollTop = targetScrollTop;
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

            // Linear easing 적용
            //element.scrollTop = start + (targetScrollTop - start) * progress;

            if (progress < 1) {
                element.animationFrame = requestAnimationFrame(animateScroll);
            }
        }

        requestAnimationFrame(animateScroll);*/
    }


}

export default IgmePreview;