"use scrict";

var _ = require("lodash"),
    Sequelize = require("sequelize"),
    SequelizeG = require("./index.js")
    assert = require("assert"),
    when = require("when");

var sequelize = new Sequelize("sequelize_generator",
    "root",
    "", {
        dialect: "mysql",
        logging: false
    });

describe("Sequelize generator", function () {
    "use strict";

    var sync = function () {
        return sequelize.sync({
            force: true
        });
    };

    it("should instantiate a model without relationships", function (done) {
        var ModelWithoutRelationship = sequelize.define("modelWithoutRelationship", {});

        sync().then(function () {
            return new SequelizeG(ModelWithoutRelationship).then(function (modelChild) {
                assert.ok(modelChild.daoFactoryName === ModelWithoutRelationship.name);
            });
        }).then(done, done);
    });

    it("should instantiate a child model and automatically the parent it belongs to", function (done) {
        var ModelParent = sequelize.define("ModelParent", {}),
            ModelChild = sequelize.define("ModelChild", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (modelChild) {
                return modelChild.getModelParent().then(function (modelParent) {
                    assert.ok(modelParent.daoFactoryName === ModelParent.name);
                });
            });
        }).then(done, done);
    });

    it("should instantiate a child model and automatically the multiple parents it belongs to", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            parentModels = new Array(10),
            parentModelsLength = parentModels.length;

        for (var i = 0; i < parentModelsLength; i++) {
            var ModelParent = sequelize.define("ModelParent" + i, {});

            parentModels[i] = ModelParent;

            ModelChild.belongsTo(ModelParent);
        }

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (modelChild) {
                return when.all(parentModels.map(function (ParentModel, i) {
                    return modelChild["getModelParent" + i]().then(function (modelParentI) {
                        assert.ok(modelParentI.daoFactoryName === parentModels[i].name);

                        return i; // Used as a counter on the length assert below
                    });
                }));
            });
        }).then(function (is) {
            assert.equal(parentModelsLength, is.length);
            done();
        }, done);
    });

    it("should instantiate a child model, its parent, and its grandparent", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {});

        ModelChild.belongsTo(ModelParent);
        ModelParent.belongsTo(ModelGrandParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (modelChild) {
                return modelChild.getModelParent().then(function (modelParent) {
                    assert.ok(modelParent.daoFactoryName === ModelParent.name);

                    return modelParent;
                });
            }).then(function (modelParent) {
                return modelParent.getModelGrandParent().then(function (modelGrandParent) {
                    assert.ok(modelGrandParent.daoFactoryName === ModelGrandParent.name);
                });
            });
        }).then(done, done);
    });

    it("should instantiate a child model, and several of its ancestor generations", function (done) {
        var modelsGenerations = [sequelize.define("Model0", {})],
            additionalModelsNumber = 9;

        for (var i = 1; i < additionalModelsNumber + 1; i++) {
            var Model = sequelize.define("Model" + i, {}),
                previousModel = modelsGenerations[i - 1];

            modelsGenerations[i] = Model;

            previousModel.belongsTo(Model);
        }

        sync().then(function () {
            return new SequelizeG(modelsGenerations[0]).then(function (model0) {
                return when.reduce(modelsGenerations, function (currentResult, value, index, total) {
                    if (index < total - 1) {
                        assert.ok(currentResult.daoFactoryName === value.name);
                        return currentResult["getModel" + (index + 1)]();
                    } else {
                        return total;
                    }
                }, model0);
            });
        }).then(function (total) {
            assert.equal(additionalModelsNumber + 1, total);
            done();
        }, done);
    });
});
