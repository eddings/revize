"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_1 = require("vega-lite/build/src/data");
const CompositionView_1 = require("./CompositionView");
const ConcatView_1 = require("./ConcatView");
const FacetView_1 = require("./FacetView");
const LayerView_1 = require("./LayerView");
const PlotView_1 = require("./PlotView");
const RepeatView_1 = require("./RepeatView");
const SpecUtils_1 = require("./SpecUtils");
const DataModel_1 = require("../DataModel");
class SpecCompiler {
    getBasicSchema(template) {
        // check for empty templates, which should also generate valid specs
        if (template && template.visualElements.length === 0 && template.parent === null) {
            return {
                $schema: 'https://vega.github.io/schema/vega-lite/v3.json',
                mark: 'area',
                encoding: {}
            };
        }
        return {
            $schema: 'https://vega.github.io/schema/vega-lite/v3.json'
        };
    }
    setCompositionProperties(schema, template) {
        if (template.columns !== undefined) {
            schema.columns = template.columns;
        }
        if (template.spacing !== undefined) {
            schema.spacing = template.spacing;
        }
        return schema;
    }
    setToplevelProperties(schema, template, includeData = true) {
        if (includeData && !!template.data) {
            schema.data = template.data;
            const dataNode = template.dataTransformationNode;
            if (dataNode instanceof DataModel_1.TransformNode) {
                schema.transform = dataNode.getTransform();
            }
            else if (dataNode instanceof DataModel_1.DatasetNode) {
                schema.transform = dataNode.getAllChildNodes().map(node => node.transform);
            }
        }
        if (includeData && !!template.datasets) {
            schema.datasets = template.datasets;
        }
        if (template.bounds !== undefined) {
            schema.bounds = template.bounds;
        }
        if (template.height !== undefined) {
            schema.height = template.height;
        }
        if (template.width !== undefined) {
            schema.width = template.width;
        }
        if (template.config !== undefined) {
            schema.config = template.config;
        }
        if (template.projection !== undefined) {
            schema.projection = template.projection;
        }
        if (template instanceof CompositionView_1.CompositionView) {
            schema = this.setCompositionProperties(schema, template);
        }
        return schema;
    }
    getRootTemplate(template) {
        let workingNode = template;
        while (workingNode.parent !== null) {
            workingNode = workingNode.parent;
        }
        return workingNode;
    }
    abstractCompositions(schema, compositionProperty) {
        const abstraction = SpecUtils_1.getAbstraction(schema);
        if (compositionProperty === 'spec' || compositionProperty === 'facet') {
            schema[compositionProperty] = abstraction;
        }
        else {
            schema[compositionProperty] = [abstraction];
        }
        return schema;
    }
    applyRepeatLayout(template, schema) {
        schema = this.abstractCompositions(schema, 'spec');
        // parent must be repeat template to reach this branch
        schema.repeat = template.parent.repeat;
        return schema;
    }
    applyFacetLayout(template, schema) {
        const parentTemplate = template.parent;
        if (parentTemplate.isInlineFacetted) {
            if (schema.encoding === undefined) {
                schema.encoding = {};
            }
            schema.encoding.facet = parentTemplate.facet;
        }
        else {
            schema = this.abstractCompositions(schema, 'spec');
            schema.facet = parentTemplate.facet;
        }
        return schema;
    }
    applyConcatLayout(schema) {
        return this.abstractCompositions(schema, 'hconcat');
    }
    applyOverlayLayout(schema) {
        return this.abstractCompositions(schema, 'layer');
    }
    applyCompositionLayout(template, schema, composition) {
        if (composition === 'repeat') {
            this.applyRepeatLayout(template, schema);
        }
        else if (composition === 'facet') {
            this.applyFacetLayout(template, schema);
        }
        else if (composition === 'concatenate') {
            this.applyConcatLayout(schema);
        }
        else if (composition === 'overlay') {
            this.applyOverlayLayout(schema);
        }
        return schema;
    }
    getDataInHierarchy(template) {
        // data can be stored either in a child node or on the top level template, therefore find the
        // top level, get its flat hierarchy and find a template with a dataset bound to it
        let topLevelTemplate = template;
        let data = null;
        while (topLevelTemplate.parent !== null) {
            if (topLevelTemplate.data !== undefined && topLevelTemplate.data !== null) {
                data = topLevelTemplate.data;
                return data;
            }
            topLevelTemplate = topLevelTemplate.parent;
        }
        const flatHierarchy = topLevelTemplate.getFlatHierarchy();
        const dataTemplate = flatHierarchy.find(t => {
            return t.data !== null && t.data !== undefined;
        });
        // could occur when template has no parent, no visualelements and no data (i.e. is "empty")
        if (dataTemplate === undefined) {
            return {
                values: [],
            };
        }
        data = dataTemplate.data;
        return data;
    }
    getDatasetsInAncestry(template) {
        // if the template references a namedDataset, also include that dataset.
        if (template.data !== null && !data_1.isNamedData(template.data)) {
            return null;
        }
        let workingNode = template;
        while (workingNode !== null && (workingNode.datasets === null || workingNode.datasets === undefined)) {
            workingNode = workingNode.parent;
        }
        if (workingNode === null) {
            return null;
        }
        return workingNode.datasets;
    }
    getRepeatSpec(parentTemplate) {
        const template = parentTemplate.visualElements[0];
        const layout = parentTemplate.layout;
        let schema = null;
        schema = this.getVegaSpecification(template, false);
        if (schema !== null) {
            schema = this.applyCompositionLayout(template, schema, layout);
        }
        return schema;
    }
    getFacetSpec(parentTemplate) {
        const encodingTemplate = parentTemplate.visualElements[0];
        let schema = null;
        // use the encodings from the child template, then apply facetting properties
        schema = this.getVegaSpecification(encodingTemplate, false);
        schema = this.applyCompositionLayout(encodingTemplate, schema, 'facet');
        return schema;
    }
    getMultiViewSpec(template, useOverwrittenEncodings) {
        const templates = template.visualElements;
        const schema = this.getBasicSchema();
        const overwriteChildEncodings = !(template instanceof RepeatView_1.RepeatView) && useOverwrittenEncodings;
        const individualSchemas = templates
            .map(t => this.getVegaSpecification(t, false, overwriteChildEncodings));
        const individualViewAbstractions = individualSchemas
            .map(s => SpecUtils_1.getAbstraction(s));
        if (template instanceof ConcatView_1.ConcatView) {
            if (template.isVertical) {
                schema.vconcat = individualViewAbstractions;
            }
            else {
                schema.hconcat = individualViewAbstractions;
            }
        }
        else if (template instanceof LayerView_1.LayerView) {
            if (template.groupEncodings.size > 0) {
                schema.encoding = {};
                template.groupEncodings.forEach((value, key) => schema.encoding[key] = value);
                individualViewAbstractions.forEach(abstraction => {
                    delete abstraction.data;
                    delete abstraction.datasets;
                });
            }
            schema.layer = individualViewAbstractions;
        }
        return schema;
    }
    getPlotSchema(template, inferData, useOverwrittenEncodings) {
        const schema = this.getBasicSchema();
        let data = template.data;
        let datasets = template.datasets;
        if (inferData) {
            data = this.getDataInHierarchy(template);
            datasets = this.getDatasetsInAncestry(template);
        }
        if (data !== undefined && data !== null) {
            schema.data = data;
        }
        if (datasets !== undefined && datasets !== null) {
            schema.datasets = datasets;
        }
        schema.mark = template.mark;
        if (template.selection !== undefined) {
            schema.selection = template.selection;
        }
        schema.encoding = {};
        template.encodings.forEach((value, key) => {
            schema.encoding[key] = value;
        });
        // do not overwrite encodings of repeated plots, as this would in turn use a mapping to a field
        // instead of the repeated column/row
        if (useOverwrittenEncodings) {
            template.overwrittenEncodings.forEach((value, key) => {
                schema.encoding[key] = value;
            });
        }
        return schema;
    }
    getCompositionSchema(template, inferData, useOverwrittenEncodings) {
        let schema = null;
        let data = null;
        let datasets = null;
        if (template.visualElements.length === 0) {
            schema = this.getBasicSchema(template);
        }
        else if (template instanceof RepeatView_1.RepeatView) {
            schema = this.getRepeatSpec(template);
        }
        else if (template instanceof FacetView_1.FacetView) {
            schema = this.getFacetSpec(template);
        }
        else {
            schema = this.getMultiViewSpec(template, useOverwrittenEncodings);
        }
        if (inferData) {
            data = this.getDataInHierarchy(template);
            datasets = SpecUtils_1.getAllDatasetsInHierarchy(template);
        }
        else {
            data = template.data;
            datasets = template.datasets;
        }
        if (data !== undefined && data !== null) {
            schema.data = data;
        }
        if (datasets !== undefined && datasets !== null) {
            schema.datasets = datasets;
        }
        if (template.resolve !== undefined) {
            schema.resolve = template.resolve;
        }
        return schema;
    }
    getVegaSpecification(template, inferProperties = false, useOverwrittenEncodings = false) {
        let schema = null;
        if (template instanceof PlotView_1.PlotView) {
            schema = this.getPlotSchema(template, inferProperties, useOverwrittenEncodings);
        }
        else if (template instanceof CompositionView_1.CompositionView) {
            schema = this.getCompositionSchema(template, inferProperties, useOverwrittenEncodings);
        }
        schema = this.setToplevelProperties(schema, template);
        if (inferProperties) {
            const rootTemplate = this.getRootTemplate(template);
            schema = this.setToplevelProperties(schema, rootTemplate, false);
        }
        return schema;
    }
}
exports.SpecCompiler = SpecCompiler;