/// <mls fileReference="_102027_/l2/collabSpliterHorizontalVarFixed.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, css, LitElement } from 'lit';
import { customElement, property, queryAll } from 'lit/decorators.js';
import { collab_chevron_right } from '/_100554_/l2/collabIcons.js'

@customElement('collab-spliter-horizontal-var-fixed-102027')
export class CollabSpliterHorizontalVarFixed100554 extends LitElement {

    @property({ type: String }) fixedwidth = '0';
    @property({ type: String }) complementcolor = '#000';
    @property({ type: String }) fixedvisible: 'hidden' | 'visible' | 'closed' = 'visible';
    @property({ type: Number }) spliterWidth = 20;
    @property({ type: String }) actualfixedwidth = this.fixedwidth;
    @property({ type: String }) msize = '';
    @property() open: boolean = true;
    @property() openUser: boolean | undefined;

    @queryAll('[slot="left"]') slotLeft: HTMLElement[] | undefined;
    @queryAll('[slot="right"]') slotRight: HTMLElement[] | undefined;


    createRenderRoot() {
        return this;
    }

    updated(changedProperties: Map<string | number | symbol, unknown>) {

        if (changedProperties.has('fixedvisible')) {
            const fixedvisible = changedProperties.get('fixedvisible');
            if ((fixedvisible === 'hidden' || fixedvisible === 'closed') && (this.fixedvisible === 'visible' && this.openUser !== undefined && this.openUser === false)) {
                this.open = false;
            } else this.open = this.fixedvisible === 'visible' ? true : false;
            this.setFixedValueInPx();
        }

        if (changedProperties.has('open')) {
            this.updatePanelsMSize();
        }

        if (changedProperties.has('msize')) {
            this.setFixedValueInPx();
            this.updatePanelsMSize(!this.open);
        }

        if ((changedProperties.has('fixedvisible') && changedProperties.get('fixedvisible') === 'hidden' && this.fixedvisible === 'visible') ||
            (changedProperties.has('fixedvisible') && this.fixedvisible === 'closed')
        ) {
            this.setFixedValueInPx();
            this.updatePanelsMSize();

        }

        if (changedProperties.has('fixedwidth')) {
            this.setFixedValueInPx();
            this.updatePanelsMSize();
        }

        if (changedProperties.has('complementcolor')) {
            this.style.setProperty('--complement-color', this.complementcolor);
        }
    }

    private setFixedValueInPx() {

        if (this.fixedwidth.endsWith('%')) {
            const msize = this.getMSize();
            const percent = this.fixedwidth.replace('%', '');
            const percentInPx = ((+msize.width) / 100) * (+percent);
            let percentInPx2 = Number.parseFloat(percentInPx.toFixed(2))
            if (percentInPx2 < 300 && percentInPx2 > 0) percentInPx2 = 300;

            this.actualfixedwidth = this.open ? percentInPx2.toString() : '0';
            this.style.setProperty('--fixed-width', this.actualfixedwidth + 'px');
            if (this.open) this.style.setProperty('--right-pane-width', this.actualfixedwidth + 'px');
            return;
        }

        this.style.setProperty('--fixed-width', this.actualfixedwidth + 'px');
        if (this.open) this.style.setProperty('--right-pane-width', this.actualfixedwidth + 'px');
        this.actualfixedwidth = this.fixedwidth;

    }

    private getMSize() {
        const [w, h, t, l] = this.msize.split(',');
        return {
            heigth: h,
            width: w,
            top: t,
            left: l
        }
    }

    private getMSizeLeft() {
        const msize = this.getMSize();
        let newWidth: string = '';
        let newMsize: string[] = [];

        if (this.fixedvisible === 'visible') newWidth = (+(msize.width) - (+this.actualfixedwidth) - (this.spliterWidth)).toString();
        else if (this.fixedvisible === 'closed') newWidth = (+(msize.width) - (+this.spliterWidth)).toString();
        else newWidth = msize.width;
        newMsize = [`${newWidth}`, msize.heigth, msize.top, msize.left];
        return newMsize.join(',');
    }

    private getMSizeRight() {
        const msize = this.getMSize();
        let newWidth: string = '';
        let newMsize: string[] = [];
        if (this.fixedvisible === 'visible') newWidth = this.actualfixedwidth;
        else if (this.fixedvisible === 'closed') newWidth = '0';
        else newWidth = '0'
        newMsize = [`${newWidth}`, msize.heigth, msize.top, msize.left];
        return newMsize.join(',');
    }

    private updateMyHeight() {
        const msize = this.getMSize();
        this.style.height = msize.heigth + 'px';
    }

    async delay() {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    private async updatePanelsMSize(reset: boolean = true) {

        if (reset) {
            this.slotLeft?.forEach((item) => item.setAttribute('msize', ''));
            this.slotRight?.forEach((item) => item.setAttribute('msize', ''));
            await this.delay();
        }
        this.updateMyHeight();
        this.slotLeft?.forEach((item) => item.setAttribute('msize', this.getMSizeLeft()));
        this.slotRight?.forEach((item) => item.setAttribute('msize', this.getMSizeRight()));
        // if (this.slotLeft) this.slotLeft.setAttribute('msize', this.getMSizeLeft());
        // if (this.slotRight) this.slotRight.setAttribute('msize', this.getMSizeRight());

    }

    public resizeItens() {
        this.setFixedValueInPx();
        this.slotLeft?.forEach((item) => item.setAttribute('msize', this.getMSizeLeft()));
        this.slotRight?.forEach((item) => item.setAttribute('msize', this.getMSizeRight()));
    }

    _applyMSize() {
        const [maxWidth, maxHeight] = this.msize.split(',').map(Number);
        if (!isNaN(maxHeight) && !isNaN(maxWidth)) {
            this.style.setProperty('--max-width', `${maxWidth}px`);
            this.style.setProperty('--max-height', `${maxHeight}px`);
        }
        this.updatePanelsMSize();
    }

    _onSpliterClick(event: MouseEvent) {

        const spliter = event.target as HTMLElement;
        const button = spliter.closest('.spliter-button')

        if (button) {
            this.fixedvisible = 'visible';

            const rightPane = this.querySelector('.right-pane') as HTMLElement;
            this.open = !this.open;
            this.openUser = this.open;
            if (this.open) {
                rightPane.classList.remove('closed');
                rightPane.style.display = 'block';

                this.setFixedValueInPx();
                this.style.setProperty('--right-pane-width', this.actualfixedwidth + 'px');
            } else {
                this.actualfixedwidth = '0';
                rightPane.classList.add('closed');
                rightPane.style.display = 'none';
                this.style.setProperty('--right-pane-width', '0px');
            }
            this.updatePanelsMSize();
        }
    }

    _distributeContent() {
        const leftPane = this.querySelector('.left-pane');
        const rightPane = this.querySelector('.right-pane');
        const children = Array.from(this.children);

        children.forEach(child => {
            const slotName = child.getAttribute('slot');
            if (slotName === 'left' && leftPane) {
                leftPane.appendChild(child);
            } else if (slotName === 'right' && rightPane) {
                rightPane.appendChild(child);
            }
        });

        this.updatePanelsMSize();

    }

    firstUpdated() {
        this._distributeContent();
        this.updatePanelsMSize();
    }

    render() {

        return html`
      <div class="left-pane"></div>

      ${(this.fixedvisible === 'visible' || this.fixedvisible === 'closed') ?
                html`<div class="spliter">
                  <div @click=${this._onSpliterClick} class="spliter-button ${!this.open ? "closed" : ""}">
                      <i>${collab_chevron_right}</i>          
                  </div>
              </div>
              `
                :
                html``}
      <div class="right-pane ${this.fixedvisible === 'closed' ? "closed" : ""}"></div>
      <style>${this.styles}</style>
    `;
    }

    private styles = `
    collab-spliter-horizontal-var-fixed-100554 {
      display: flex;
      height: var(--max-height);
      width: var(--max-width);
      max-width: var(--max-width);
      max-height: var(--max-height);
      position: relative;
      
    }
    collab-spliter-horizontal-var-fixed-100554 > .spliter {
      display: flex;
      align-items: center;
      width: 20px;
      background-color: var(--complement-color);
      position: relative;
      z-index: 1;
      border-right: 1px solid #cecece;
    }
    collab-spliter-horizontal-var-fixed-100554 > .spliter .spliter-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height:60px;
      background-color: var(--collab-nav-bg-1);
      cursor: pointer;
      position: relative;
      z-index: 1;
      border-top-left-radius: 5px;
      border-bottom-left-radius: 5px;
      background-color: #f9f9f9;
    }

    collab-spliter-horizontal-var-fixed-100554 > .spliter .spliter-button i {
      transition: transform 0.8s ease;
    }

    collab-spliter-horizontal-var-fixed-100554 > .spliter .spliter-button.closed i {
      transform: rotate(180deg);
    }

    collab-spliter-horizontal-var-fixed-100554 > .spliter .spliter-button i {
      cursor: pointer;
    }

    collab-spliter-horizontal-var-fixed-100554 > .left-pane, .right-pane {
      overflow: auto;
      overflow-x: hidden;
    }
    collab-spliter-horizontal-var-fixed-100554 > .left-pane {
      background-color: var(--complement-color);
      flex-grow: 1;
    }
    collab-spliter-horizontal-var-fixed-100554 > .right-pane {
      background-color: var(--collab-nav-bg-1);
      transition: width 0.8s;
      max-width: var(--fixed-width);
      width: var(--right-pane-width, var(--fixed-width));
    }
    collab-spliter-horizontal-var-fixed-100554 > .right-pane.closed {
      display:none;
      transition: width 0s;
      width: 0;
    }
  `;

}




