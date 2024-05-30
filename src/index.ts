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
} from "crypto";
import minify from "css-minify"

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
writeFileSync(`${source}/critical-${finalHash}.css`, await minify(stringify({type: 'stylesheet', stylesheet: {rules: critical,}})));
writeFileSync(
    `${source}/../index.html`,
    readFileSync(`${source}/../index.html`, 'utf8').replace(/<\/head>/iug, `<link rel="stylesheet" href="/assets/critical-${finalHash}.css"/></head>`),
    'utf8',
)