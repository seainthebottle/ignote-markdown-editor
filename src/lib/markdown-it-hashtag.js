export default function markdownItHashtag(md, options = {}) {
    // Destructure and provide default configuration options:
    const {
        tagUrl = (tag) => `/tags/${encodeURIComponent(tag)}`, // Function to generate URL for hashtags
        tagClass = 'hashtag',                                 // CSS class to apply to hashtag links
        tagRegex = /#([\w가-힣]+)/g                           // Regular expression for detecting hashtags
    } = options;

    const foundHashtags = new Set();

    function hashtagReplacer(state) {
        state.tokens.forEach(blockToken => {
            if (blockToken.type !== 'inline') return;

            const tokens = blockToken.children;

            tokens.forEach((token, idx) => {
                if (token.type === 'text') {
                    let text = token.content;
                    let match;
                    let lastIndex = 0;
                    const nodes = [];

                    // Iterate over all hashtag matches in the text
                    while ((match = tagRegex.exec(text)) !== null) {
                        const hashtag = match[1];
                        foundHashtags.add(hashtag);

                        if (match.index > lastIndex) {
                            nodes.push(new state.Token('text', '', 0));
                            nodes[nodes.length - 1].content = text.slice(lastIndex, match.index);
                        }

                        const linkOpen = new state.Token('link_open', 'a', 1);
                        linkOpen.attrs = [['href', tagUrl(hashtag)], ['class', tagClass]];

                        const linkText = new state.Token('text', '', 0);
                        linkText.content = `#${hashtag}`;

                        const linkClose = new state.Token('link_close', 'a', -1);

                        nodes.push(linkOpen, linkText, linkClose);

                        lastIndex = tagRegex.lastIndex;
                    }

                    if (lastIndex < text.length) {
                        nodes.push(new state.Token('text', '', 0));
                        nodes[nodes.length - 1].content = text.slice(lastIndex);
                    }

                    if (nodes.length) {
                        blockToken.children = tokens.slice(0, idx).concat(nodes).concat(tokens.slice(idx + 1));
                    }
                }
            });
        });
    }

    // Register the hashtag replacer as part of markdown-it's core processing pipeline
    md.core.ruler.push('hashtag_replacer', hashtagReplacer);

    // Expose a method to retrieve the found hashtags
    // Use this method after rendering markdown to access the collected hashtags
    md.getFoundHashtags = () => Array.from(foundHashtags);
}
