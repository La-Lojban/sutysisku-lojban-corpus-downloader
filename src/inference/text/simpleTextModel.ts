import { FeatureExtractionModel } from "./featureExtractionModel.js";
import { TextMetadata } from "./metadata.js";

export interface InitTextModelResult {
  model: SimpleTextModel;
  elapsed: number;
}

export class SimpleTextModel {
  static create = async (
    modelMetadata: TextMetadata
  ): Promise<InitTextModelResult> => {
    const model = new FeatureExtractionModel(modelMetadata);
    const elapsed = await model.init();
    return {
      model: model,
      elapsed: elapsed,
    };
  };
}
