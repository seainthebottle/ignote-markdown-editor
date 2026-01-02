# ignote-markdown-editor
- Markdown editor for Ignote

## 패키징
- yarn build

## 일러두기
- 나중에 min.js로 출력하려면 package.json의 build를 다음과 같이 수정한다.  
  `"build": "vite build && terser modules/ignote-markdown-editor.js -o modules/ignote-markdown-editor.min.js --compress --mangle",`
