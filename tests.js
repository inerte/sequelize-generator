"use scrict";

var Promise = require("promise"),
    Sequelize = require("sequelize"),
    assert = require("assert"),
    SequelizeG = require("./index.js");

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
                return new Promise.all(parentModels.map(function (ParentModel, i) {
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
});
