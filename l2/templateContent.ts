/// <mls fileReference="_102027_/l2/templateContent.ts" enhancement="_blank" />

/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
import { noChange } from '/_102027_/l2/litHtml.js';
import { Directive, PartInfo }  from '/_102027_/l2/directive.js';
declare class TemplateContentDirective extends Directive {
    private _previousTemplate?;
    constructor(partInfo: PartInfo);
    render(template: HTMLTemplateElement): DocumentFragment | typeof noChange;
}
/**
 * Renders the content of a template element as HTML.
 *
 * Note, the template should be developer controlled and not user controlled.
 * Rendering a user-controlled template with this directive
 * could lead to cross-site-scripting vulnerabilities.
 */
export declare const templateContent: (template: HTMLTemplateElement) => import("/_102027_/l2/directive.js").DirectiveResult<typeof TemplateContentDirective>;
/**
 * The type of the class that powers this directive. Necessary for naming the
 * directive's return type.
 */
export type { TemplateContentDirective };
//# sourceMappingURL=template-content.d.ts.map