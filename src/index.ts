import {
    parse,
    stringify,
} from 'css';
import {
    readdirSync,
    writeFileSync,
    readFileSync,
} from 'fs';
import {
    createHash,
} from 'crypto';
import minify from 'css-minify'

const source = `${ process.cwd() }/dist/assets`;
const critical = [];
const criticalProperties = [
    'height',
    'width',
    'display',
    'float',
    'font',
    'font-size',
    'max-width',
    'min-width',
    'max-height',
    'min-height',
    'font-weight',
    'margin',
    'margin-top',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'position',
    'z-index',
    'gap',
    'bottom',
    'top',
    'left',
    'right',
];
const hash = createHash('sha256');
for (const file of readdirSync(source, 'utf8')) {
    if (file.endsWith('.css')) {
        hash.update(file)
        const css = parse(readFileSync(source + '/' + file, 'utf8'));
        for (const ruleOrMedia of css.stylesheet.rules) {
            if (ruleOrMedia.type === 'rule') {
                const copy = {
                    type: 'rule',
                    selectors: ruleOrMedia.selectors ?? [],
                    declarations: [],
                };
                for (const declaration of ruleOrMedia.declarations ?? []) {
                    if (criticalProperties.includes(declaration.property)) {
                        copy.declarations.push(declaration);
                    }
                }
                ruleOrMedia.declarations = ruleOrMedia.declarations.filter((decl) => ! criticalProperties.includes(decl.property));
                if (copy.declarations.length > 0) {
                    critical.push(copy);
                }
            } else if (ruleOrMedia.type === 'media') {
                const media = {
                    type: 'media',
                    rules: [],
                    media: ruleOrMedia.media,
                };
                for (const rule of ruleOrMedia.rules) {
                    for (const declaration of rule.declarations ?? []) {
                        const copy = {
                            type: 'rule',
                            selectors: rule.selectors ?? [],
                            declarations: [],
                        };
                        if (criticalProperties.includes(declaration.property)) {
                            copy.declarations.push(declaration);
                        }
                        if (copy.declarations.length > 0) {
                            media.rules.push(copy);
                        }
                    }
                    rule.declarations = rule.declarations.filter((decl) => ! criticalProperties.includes(decl.property));
                }
                ruleOrMedia.rules = ruleOrMedia.rules.filter((rule) => rule.declarations.length > 0);
                if (media.rules.length > 0) {
                    critical.push(media);
                }
            }
        }
        css.stylesheet.rules = css.stylesheet.rules.filter((rule) => rule?.declarations?.length || rule?.rules?.length);
        writeFileSync(source + '/' + file, await minify(stringify(css)), 'utf8');
    }
}
const finalHash = hash.digest('hex');
const index = readFileSync(`${source}/../index.html`, 'utf8');
const styles = await minify(stringify({
    type: 'stylesheet',
    stylesheet: {rules: critical,}
}));
if (process.argv.includes('--inline')) {
    const sheet = index.match(/<link rel="stylesheet" crossorigin href="(.+?)">/ui)[1];
    writeFileSync(
        `${source}/../index.html`,
        index
            .replace(/<link rel="stylesheet"/iug, '<link rel="preload" as="style"')
            .replace(/<\/style>/iug, `</style><style>${styles}</style>`)
            .replace(/<\/body>/iug, `<script>(()=>{const n=document.createElement('link');n.setAttribute('rel','stylesheet');n.setAttribute('href','${sheet}');document.getElementsByTagName('head')[0].appendChild(n);n.parentElement.insertBefore(n, document.getElementsByTagName('style')[0])})()</script></body>`),
        'utf8',
    );
} else {
    writeFileSync(`${source}/critical-${finalHash}.css`, styles);
    writeFileSync(
        `${source}/../index.html`,
        index
            .replace(/<\/head>/iug, `<link rel="stylesheet" href="/assets/critical-${finalHash}.css"/></head>`),
        'utf8',
    );
}