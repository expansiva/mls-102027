/// <mls fileReference="_102027_/l2/msizeHeight.ts" enhancement="_blank"/>

export function heightFromMsize(msize: string | null): number | null {
    if (msize == null || msize === '') return null;
    const height = parseFloat(msize.split(',')[1] || '');
    if (!Number.isFinite(height) || height <= 0) return null;
    return height;
}

export function applyMsizeHeight(
    el: { style: { height: string; overflow: string } },
    msize: string | null,
): boolean {
    const height = heightFromMsize(msize);
    if (height == null) return false;
    el.style.height = height + 'px';
    el.style.overflow = 'auto';
    return true;
}
