/// <mls shortName="unsafeHtml" project="102027" enhancement="_blank" />

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
import { nothing, TemplateResult, noChange } from '/_102027_/l2/litHtml.js';
import { Directive, PartInfo } from '/_102027_/l2/directive.js';
export declare class UnsafeHTMLDirective extends Directive {
    static directiveName: string;
    static resultType: number;
    private _value;
    private _templateResult?;
    constructor(partInfo: PartInfo);
    render(value: string | typeof nothing | typeof noChange | undefined | null): typeof noChange | typeof nothing | TemplateResult | null | undefined;
}
/**
 * Renders the result as HTML, rather than text.
 *
 * The values `undefined`, `null`, and `nothing`, will all result in no content
 * (empty string) being rendered.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */
export declare const unsafeHTML: (value: string | typeof noChange | typeof nothing | null | undefined) => import("/_102027_/l2/directive.js").DirectiveResult<typeof UnsafeHTMLDirective>;
//# sourceMappingURL=unsafe-html.d.ts.map