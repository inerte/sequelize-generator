var _ = require("lodash"),
    Sequelize = require("sequelize"),
    SequelizeG = require("../index.js"),
    assert = require("assert");

var sequelize = new Sequelize("myapp_test",
    "travis",
    "", {
        dialect: "mysql",
        logging: false
    });

describe("Sequelize generator data type fields pre-population", function () {
    "use strict";

    afterEach(function () {
        // Undo the model definition or it hangs on the sequelize object, infecting
        // subsequent tests
        var daoNames = _.pluck(sequelize.daoFactoryManager.daos, "name");

        daoNames.forEach(function (daoName) {
            sequelize.daoFactoryManager.removeDAO(sequelize.daoFactoryManager.getDAO(daoName));
        });
    });

    var sync = function () {
        return sequelize.getQueryInterface().dropAllTables().then(function () {
            return sequelize.sync({
                force: true
            });
        });
    };

    it("should populate INTEGER with integers on child model", function (done) {
        var Model = sequelize.define("Model", {
            number: Sequelize.INTEGER
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isNumber(instance.number));
            });
        }).then(done, done);
    });

    it("should populate INTEGER with integers on parent models", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {
                number: Sequelize.INTEGER
            });

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getModelParent();
            }).then(function (parent) {
                assert.ok(_.isNumber(parent.number));
            });
        }).then(done, done);
    });

    it("should populate ENUM with any value from its possible values", function (done) {
        var possibleValues = ["Julio", "José"],
            Model = sequelize.define("Model", {
                name: {
                    type: Sequelize.ENUM,
                    values: possibleValues
                }
            });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.contains(possibleValues, instance.name));
            });
        }).then(done, done);
    });

    it("should populate STRING with random string", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isString(instance.name));
                assert.ok(instance.name.length > 0);
            });
        }).then(done, done);
    });

    it("should populate STRING(n) with random string", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING(42)
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isString(instance.name));
                assert.ok(instance.name.length > 0);
            });
        }).then(done, done);
    });

    it("should populate CHAR with random string", function (done) {
        var Model = sequelize.define("Model", {
            name: "CHAR"
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isString(instance.name));
                assert.ok(instance.name.length > 0);
            });
        }).then(done, done);
    });

    it("should populate CHAR(n) with random string", function (done) {
        var Model = sequelize.define("Model", {
            name: "CHAR(32)"
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isString(instance.name));
                assert.ok(instance.name.length > 0);
            });
        }).then(done, done);
    });

    it("should populate SMALLINT UNSIGNED with random number", function (done) {
        var Model = sequelize.define("Model", {
            number: "SMALLINT UNSIGNED"
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isNumber(instance.number));
            });
        }).then(done, done);
    });
});
