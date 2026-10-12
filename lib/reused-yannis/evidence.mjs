// Reused from Yanni's lib/mailbox/conversation/evidence.ts.
// TypeScript annotations removed; algorithm unchanged. See README.md.
/** Resolve whitespace, typographic quotes and omitted paired Markdown emphasis
 * to an exact original span. No general punctuation deletion or paraphrase.
 * Values and negations must remain intact. The persisted evidence is the source,
 * never the model's retyped version.
 */
export function sourceQuote(source        , quote        )                {
    if (!quote.trim())
        return null;
    if (source.includes(quote))
        return quote;
    function indexed(text        , emphasis = false) {
        let value = '';
        const starts           = [], ends           = [];
        const omit=new Set        (),opens=new Map               (),closes=new Map               ();
        // Only paired, flanking * / ** markers. Literal multiplication, escapes,
        // unmatched markers and intraword stars retain their original meaning.
        if(emphasis)for(const match of text.matchAll(/(?<![\w*\\])(\*{1,2})(?=\S)([^*]{1,1000}?\S)\1(?=$|[\s.,;:!?)\]])/g)){
            const start=match.index ,width=match[1].length,end=start+match[0].length;
            if(/\n\s*\n/.test(match[2]))continue;
            for(let n=0;n<width;n++){omit.add(start+n);omit.add(end-width+n);}
            opens.set(start+width,start);closes.set(end-width-1,end);
        }
        for (let i = 0; i < text.length; i++) {
            if(omit.has(i))continue;
            let c = text[i];
            if (/\s/u.test(c))
                c = ' ';
            else if (c === '\u2018' || c === '\u2019')
                c = "'";
            else if (c === '\u201c' || c === '\u201d')
                c = '"';
            if (c === ' ' && value.endsWith(' ')) {
                ends[ends.length - 1] = i + 1;
                continue;
            }
            value += c;
            starts.push(opens.get(i)??i);
            ends.push(closes.get(i)??i + 1);
        }
        return { value, starts, ends };
    }
    let original = indexed(source);
    const wanted = indexed(quote).value.trim();
    if (!wanted)
        return null;
    let at = original.value.indexOf(wanted);
    if(at<0){
        original=indexed(source,true);at=original.value.indexOf(wanted);
        if(at>=0&&original.value.indexOf(wanted,at+1)>=0)return null;
    }
    if (at < 0)
        return null;
    return source.slice(original.starts[at], original.ends[at + wanted.length - 1]);
}

/** Keep quoted mail available as history, without attributing it to the current
 * sender. The unmarked-reply boundary is deliberately narrow: another greeting
 * after a signature phone number, in a message that already has a greeting. */
export function currentBody(text        )         {
    const marked = text.search(/(?:^|\n)(?:On .+wrote:|From:|[- ]*Forwarded message[- ]*|[- ]*Original Message[- ]*|>)/i);
    let body = marked < 0 ? text : text.slice(0, marked);
    const greetings = [...body.matchAll(/^(?:Hi|Hello|Dear)[ \t]+[^\n,:]{1,60}[,:][ \tÂ\u00a0]*$/gim)];
    for (const greeting of greetings.slice(1)) {
        const before = body.slice(0, greeting.index).trimEnd();
        const signature = before.split(/\r?\n/).at(-1) ?? '';
        if (/\d[\d() .-]{6,}\d\s*$/.test(signature)) { body = body.slice(0, greeting.index); break; }
    }
    return body;
}
