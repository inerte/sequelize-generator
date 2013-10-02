var _ = require("lodash"),
    Sequelize = require("sequelize"),
    SequelizeG = require("./index.js"),
    assert = require("assert"),
    when = require("when");

var sequelize = new Sequelize("myapp_test",
    "travis",
    "", {
        dialect: "mysql",
        logging: false
    });

describe("Sequelize generator", function () {
    "use strict";

    var sync = function () {
        return sequelize.getQueryInterface().dropAllTables().then(function () {
            return sequelize.sync({
                force: true
            });
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
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getModelParent().then(function (parent) {
                    assert.ok(parent.daoFactoryName === ModelParent.name);
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
            return new SequelizeG(ModelChild).then(function (child) {
                return when.all(parentModels.map(function (ParentModel, i) {
                    return child["getModelParent" + i]().then(function (parentI) {
                        assert.ok(parentI.daoFactoryName === parentModels[i].name);

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
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getModelParent().then(function (parent) {
                    assert.ok(parent.daoFactoryName === ModelParent.name);

                    return parent;
                });
            }).then(function (parent) {
                return parent.getModelGrandParent().then(function (grandParent) {
                    assert.ok(grandParent.daoFactoryName === ModelGrandParent.name);
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

    it("should instantiate a child model, both parents, and 4 grandparents (paternal and maternal)", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelFather = sequelize.define("ModelFather", {}),
            ModelMother = sequelize.define("ModelMother", {}),
            ModelPaternalGrandFather = sequelize.define("ModelPaternalGrandFather", {}),
            ModelPaternalGrandMother = sequelize.define("ModelPaternalGrandMother", {}),
            ModelMaternalGrandFather = sequelize.define("ModelMaternalGrandFather", {}),
            ModelMaternalGrandMother = sequelize.define("ModelMaternalGrandMother", {});

        ModelChild.belongsTo(ModelFather);
        ModelChild.belongsTo(ModelMother);

        ModelFather.belongsTo(ModelPaternalGrandFather);
        ModelFather.belongsTo(ModelPaternalGrandMother);

        ModelMother.belongsTo(ModelMaternalGrandFather);
        ModelMother.belongsTo(ModelMaternalGrandMother);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                // Check father and paternal grandparents
                return child.getModelFather().then(function (father) {
                    assert.ok(father.daoFactoryName === ModelFather.name);
                    return father.getModelPaternalGrandFather().then(function (paternalGrandFather) {
                        assert.ok(paternalGrandFather.daoFactoryName === ModelPaternalGrandFather.name);

                        return father.getModelPaternalGrandMother();
                    }).then(function (paternalGrandMother) {
                        assert.ok(paternalGrandMother.daoFactoryName === ModelPaternalGrandMother.name);

                        return child;
                    });
                }).then(function (child) {
                    // Check mother and maternal grandparents
                    return child.getModelMother().then(function (mother) {
                        assert.ok(mother.daoFactoryName === ModelMother.name);
                        return mother.getModelMaternalGrandFather().then(function (maternalGrandFather) {
                            assert.ok(maternalGrandFather.daoFactoryName === ModelMaternalGrandFather.name);

                            return mother.getModelMaternalGrandMother();
                        }).then(function (maternalGrandMother) {
                            assert.ok(maternalGrandMother.daoFactoryName === ModelMaternalGrandMother.name);

                            return null;
                        });
                    });
                });
            });
        }).then(done, done);
    });

    it("should set attributes for Model", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING,
        });

        sync().then(function () {
            return new SequelizeG(Model, {
                attributes: {
                    name: "Julio Nobrega Netto"
                }
            }).then(function (child) {
                assert.equal(child.name, "Julio Nobrega Netto");
            });
        }).then(done, done);
    });

    it("should set attributes for parent model", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {
                name: Sequelize.STRING,
            });

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                ModelParent: {
                    attributes: {
                        name: "José Nobrega Netto"
                    }
                }
            }).then(function (child) {
                return child.getModelParent();
            }).then(function (parent) {
                assert.equal(parent.name, "José Nobrega Netto");
            });
        }).then(done, done);
    });

    it("should set attributes for grandparent model", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {
                name: Sequelize.STRING,
            });

        ModelChild.belongsTo(ModelParent);
        ModelParent.belongsTo(ModelGrandParent);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                ModelGrandParent: {
                    attributes: {
                        name: "Julio Nobrega" // notice the lack of Netto
                    }
                }
            }).then(function (child) {
                return child.getModelParent();
            }).then(function (parent) {
                return parent.getModelGrandParent();
            }).then(function (grandParent) {
                assert.equal(grandParent.name, "Julio Nobrega");
            });
        }).then(done, done);
    });

    it("should populate INTEGER data type fields with integers on child model", function (done) {
        var Model = sequelize.define("Model", {
            number: Sequelize.INTEGER
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (instance) {
                assert.ok(_.isNumber(instance.number));
            });
        }).then(done, done);
    });

    it("should populate INTEGER data type fields with integers on parent models", function (done) {
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

    it("should not populate INTEGER data type field on child and parents if set as attributes", function (done) {
        var childNumber = _.uniqueId(),
            parentNumber = _.uniqueId(),
            ModelChild = sequelize.define("ModelChild", {
                number: Sequelize.INTEGER
            }),
            ModelParent = sequelize.define("ModelParent", {
                number: Sequelize.INTEGER
            });

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                attributes: {
                    number: childNumber
                },
                ModelParent: {
                    attributes: {
                        number: parentNumber
                    }
                }
            }).then(function (child) {
                assert.equal(child.number, childNumber);
                return child.getModelParent();
            }).then(function (parent) {
                assert.equal(parent.number, parentNumber);
            });
        }).then(done, done);
    });

    it("should populate fields when the column is specified as an object", function (done) {
        var Model = sequelize.define("Model", {
            number1: Sequelize.INTEGER,
            number2: {
                type: Sequelize.INTEGER
            }
        });

        sync().then(function () {
            return new SequelizeG(Model).then(function (model) {
                assert.ok(_.isNumber(model.number1));
                assert.ok(_.isNumber(model.number2));
            });
        }).then(done, done);
    });

    it("should populate field with null if specified as an attribute", function (done) {
        var Model = sequelize.define("Model", {
            number: Sequelize.INTEGER
        });

        sync().then(function () {
            return new SequelizeG(Model, {
                attributes: {
                    number: null
                }
            }).then(function (model) {
                assert.ok(_.isNull(model.number));
            });
        }).then(done, done);
    });

    it("should accept as an attribute a foreign key of an already created instance", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return ModelParent.create();
        }).then(function (parent) {
            return new SequelizeG(ModelChild, {
                attributes: {
                    ModelParentId: parent.id
                }
            }).then(function (child) {
                assert.equal(parent.id, child.ModelParentId);
            });
        }).then(done, done);
    });

    it("should set a foreign key to a random, already created record, if option is set", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            var chainer = new Sequelize.Utils.QueryChainer();

            _.times(3, function () {
                chainer.add(ModelParent.create());
            });

            return chainer.run();
        }).then(function (parents) {
            var parentIds = _.pluck(parents, "id");

            return new SequelizeG(ModelChild, {
                ModelParent: "any"
            }).then(function (child) {
                assert.ok(_.contains(parentIds, child.ModelParentId));
            });
        }).then(done, done);
    });

    it("should create record with NULL on fields that reference parents when foreignKeyConstraint is true", function (done) {
        // Only the creation gets NULL. SequelizeG later calls instance.setModelParent(parentInstance) which will
        // replace NULL by parentInstance primary key
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent, {
            foreignKeyConstraint: true
        });

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getModelParent().then(function (parent) {
                    assert.ok(child.ModelParentId === parent.id);
                    assert.ok(parent.daoFactoryName === ModelParent.name);
                });
            });
        }).then(done, done);
    });
});
