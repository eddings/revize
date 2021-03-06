import { isMarkDef, isPrimitiveMark, Mark, MarkDef } from 'vega-lite/build/src/mark';
import { SelectionDef } from 'vega-lite/build/src/selection';
import { MarkEncoding } from './MarkEncoding';
import { View } from './View';

export class PlotView extends View {
  public selection?: SelectionDef;
  public staticMarkProperties?: Map<MarkEncoding, any>;

  public mark: MarkDef | Mark;

  constructor(parent: View = null) {
    super([], null, parent);

    this.mark = null;
  }

  public get type(): Mark {
    if (isPrimitiveMark(this.mark)) {
      return this.mark;
    } else if (isMarkDef(this.mark)) {
      return this.mark.type;
    }
  }

  public set type(type: Mark) {
    if (this.mark === null) {
      this.mark = type;
    } else {
      if (isPrimitiveMark(this.mark)) {
        this.mark = type;
      } else if (isMarkDef(this.mark)) {
        this.mark.type = type;
      }
    }
  }
}