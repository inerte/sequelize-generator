"use scrict";

var Sequelize = require("sequelize"),
    assert = require("assert"),
    sequelizeG = require("./index.js");

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
            return sequelizeG(ModelWithoutRelationship).then(function (modelChild) {
                assert.ok(modelChild.daoFactoryName === ModelWithoutRelationship.name);
            });
        }).then(done, done);
    });

    it("should instantiate a child model and automatically the parent it belongs to", function (done) {
        var ModelParent = sequelize.define("ModelParent", {}),
            ModelChild = sequelize.define("ModelChild", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return sequelizeG(ModelChild).then(function (modelChild) {
                return modelChild.getModelParent().then(function (modelParent) {
                    assert.ok(modelParent.daoFactoryName === ModelParent.name);
                });
            });
        }).then(done, done);
    });

    it("should instantiate a child model and automatically the multiple parents it belongs to", function (done) {
        var ModelParentA = sequelize.define("ModelParentA", {}),
            ModelParentB = sequelize.define("ModelParentB", {}),
            ModelChild = sequelize.define("ModelChild", {});

        ModelChild.belongsTo(ModelParentA);
        ModelChild.belongsTo(ModelParentB);

        sync().then(function () {
            return sequelizeG(ModelChild).then(function (modelChild) {
                return modelChild.getModelParentA().then(function (modelParentA) {
                    assert.ok(modelParentA.daoFactoryName === ModelParentA.name);

                    return modelChild;
                });
            }).then(function (modelChild) {
                return modelChild.getModelParentB().then(function (modelParentB) {
                    assert.ok(modelParentB.daoFactoryName === ModelParentB.name);
                });
            });
        }).then(done, done);
    });
});
