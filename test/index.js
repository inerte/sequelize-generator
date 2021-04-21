require('dotenv').config();

var _ = require("lodash"),
    Sequelize = require("sequelize"),
    SequelizeG = require("../index.js"),
    assert = require("assert"),
    when = require("when");

var sequelize = new Sequelize("myapp_test",
    "travis",
    "", {
        dialect: "mysql",
        logging: false,
        port: process.env.DB_PORT,
    });

describe("Sequelize generator", function () {
    "use strict";

    afterEach(function () {
        // Undo the model definition or it hangs on the sequelize object, infecting
        // subsequent tests
        var daoNames = _.map(sequelize.daoFactoryManager.daos, "name");

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

    it("should instantiate a model without relationships", function (done) {
        var ModelWithoutRelationship = sequelize.define("modelWithoutRelationship", {});

        sync().then(function () {
            return new SequelizeG(ModelWithoutRelationship).then(function (modelChild) {
                assert.strictEqual(modelChild.Model.name, ModelWithoutRelationship.name);
            });
        }).then(done, done);
    });

    it("should instantiate a child model and automatically the parent it belongs to", function (done) {
        var ModelParent = sequelize.define("ModelParent", {}),
            ModelChild = sequelize.define("ModelChild", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getModelParent();
            }).then(function (parent) {
                assert.strictEqual(parent.Model.name, ModelParent.name);
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
                        assert.strictEqual(parentI.Model.name, parentModels[i].name);

                        return i; // Used as a counter on the length assert below
                    });
                }));
            });
        }).then(function (is) {
            assert.strictEqual(parentModelsLength, is.length);
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
                    assert.strictEqual(parent.Model.name, ModelParent.name);

                    return parent;
                });
            }).then(function (parent) {
                return parent.getModelGrandParent().then(function (grandParent) {
                    assert.strictEqual(grandParent.Model.name, ModelGrandParent.name);
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
                        assert.strictEqual(currentResult.Model.name, value.name);
                        return currentResult["getModel" + (index + 1)]();
                    } else {
                        return total;
                    }
                }, model0);
            });
        }).then(function (total) {
            assert.strictEqual(additionalModelsNumber + 1, total);
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
                    assert.strictEqual(father.Model.name, ModelFather.name);
                    return father.getModelPaternalGrandFather().then(function (paternalGrandFather) {
                        assert.strictEqual(paternalGrandFather.Model.name, ModelPaternalGrandFather.name);

                        return father.getModelPaternalGrandMother();
                    }).then(function (paternalGrandMother) {
                        assert.strictEqual(paternalGrandMother.Model.name, ModelPaternalGrandMother.name);

                        return child;
                    });
                }).then(function (child) {
                    // Check mother and maternal grandparents
                    return child.getModelMother().then(function (mother) {
                        assert.strictEqual(mother.Model.name, ModelMother.name);
                        return mother.getModelMaternalGrandFather().then(function (maternalGrandFather) {
                            assert.strictEqual(maternalGrandFather.Model.name, ModelMaternalGrandFather.name);

                            return mother.getModelMaternalGrandMother();
                        }).then(function (maternalGrandMother) {
                            assert.strictEqual(maternalGrandMother.Model.name, ModelMaternalGrandMother.name);

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
                assert.strictEqual(child.name, "Julio Nobrega Netto");
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
                assert.strictEqual(parent.name, "José Nobrega Netto");
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
                assert.strictEqual(grandParent.name, "Julio Nobrega");
            });
        }).then(done, done);
    });

    it("should not populate INTEGER on child and parents if set as attributes", function (done) {
        var childNumber = _.parseInt(_.uniqueId(), 10),
            parentNumber = _.parseInt(_.uniqueId(), 10),
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
                assert.strictEqual(child.number, childNumber);
                return child.getModelParent();
            }).then(function (parent) {
                assert.strictEqual(parent.number, parentNumber);
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
                assert.strictEqual(parent.id, child.ModelParentId);
            });
        }).then(done, done);
    });

    it("should accept as an attribute an array that is consumed each time an instance is created", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING
        }),
            names = ["Julio", "Gustavo", "Felipe"];

        sync().then(function () {
            return new SequelizeG(Model, {
                number: 3,
                attributes: {
                    name: names
                }
            }).then(function (children) {
                assert.deepEqual(_.map(children, "name"), names);
            });
        }).then(done, done);
    });

    it("should accept as attributes arrays that are consumed each time an instance is created", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING,
            profession: Sequelize.STRING,
        }),
            names = ["Julio", "Gustavo", "Felipe"],
            professions = ["Programmer", "Producer", "Chef"];

        sync().then(function () {
            return new SequelizeG(Model, {
                number: 3,
                attributes: {
                    name: names,
                    profession: professions,
                }
            }).then(function (children) {
                assert.deepEqual(_.map(children, "name"), names);
                assert.deepEqual(_.map(children, "profession"), professions);
            });
        }).then(done, done);
    });

    it("should accept as an attribute an array of foreign keys that are consumed each time an instance is created", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelParent, {
                number: 2
            });
        }).then(function (parents) {
            return new SequelizeG(ModelChild, {
                number: 2,
                attributes: {
                    ModelParentId: _.map(parents, "id")
                }
            }).then(function (children) {
                assert.deepEqual(_.map(children, "ModelParentId"), _.map(parents, "id"));
            });
        }).then(done, done);
    });

    it("should accept as an attribute a function that returns the value to be set", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING
        }),
            name = "Julio";

        sync().then(function () {
            return new SequelizeG(Model, {
                attributes: {
                    name: function () {
                        return name;
                    }
                }
            }).then(function (instance) {
                assert.strictEqual(name, instance.name);
            });
        }).then(done, done);
    });

    it("should accept as an attribute a function that returns the value to be set, even for multiple instances", function (done) {
        var Model = sequelize.define("Model", {
            name: Sequelize.STRING
        }),
            name = "Julio";

        sync().then(function () {
            return new SequelizeG(Model, {
                number: 2,
                attributes: {
                    name: function () {
                        return name;
                    }
                }
            }).then(function (instance) {
                assert.strictEqual(name, instance[0].name);
                assert.strictEqual(name, instance[1].name);
            });
        }).then(done, done);
    });

    it("should create instances with a shared foreign key, if option is set", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelFather = sequelize.define("ModelFather", {}),
            ModelMother = sequelize.define("ModelMother", {}),
            ModelCommonAncestor = sequelize.define("ModelCommonAncestor", {});

        ModelChild.belongsTo(ModelFather);
        ModelChild.belongsTo(ModelMother);

        ModelFather.belongsTo(ModelCommonAncestor);
        ModelMother.belongsTo(ModelCommonAncestor);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                ModelCommonAncestor: "shared",
            }).then(function (child) {
                assert.notStrictEqual(child.generator.ModelFather.ModelCommonAncestorId, null);
                assert.strictEqual(child.generator.ModelFather.ModelCommonAncestorId, child.generator.ModelMother.ModelCommonAncestorId);
            });
        }).then(done, done);
    });

    it("should create instances with a shared foreign key, if option is set, even for multiple number", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                number: 2,
                ModelParent: "shared",
            }).then(function (children) {
                assert.strictEqual(children[0].generator.ModelParent.values.id, children[1].generator.ModelParent.values.id);
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
                    assert.strictEqual(child.ModelParentId, parent.id);
                    assert.strictEqual(parent.Model.name, ModelParent.name);
                });
            });
        }).then(done, done);
    });

    it("should set parent model when association has \"as\" option", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent, {
            foreignKey: "ModelParentId",
            as: "someName"
        });

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getSomeName();
            }).then(function (parent) {
                assert.strictEqual(parent.Model.name, ModelParent.name);
            });
        }).then(done, done);
    });

    it("should set parent and grandparent model when associations have \"as\" option", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {});

        ModelChild.belongsTo(ModelParent, {
            foreignKey: "ModelParentId",
            as: "someName"
        });

        ModelParent.belongsTo(ModelGrandParent, {
            foreignKey: "ModelGrandParentId",
            as: "someOtherName"
        });

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return child.getSomeName();
            }).then(function (parent) {
                return parent.getSomeOtherName();
            }).then(function (grandParent) {
                assert.strictEqual(grandParent.Model.name, ModelGrandParent.name);
            }).then(done, done);
        });
    });

    it("should only create parents, not children", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {});

        ModelChild.belongsTo(ModelParent);

        ModelParent.belongsTo(ModelGrandParent);

        sync().then(function () {
            return new SequelizeG(ModelParent).then(function () {
                return ModelGrandParent.count();
            }).then(function (grandParentCount) {
                assert.strictEqual(grandParentCount, 1);
            }).then(function () {
                return ModelChild.count();
            }).then(function (childrenCount) {
                assert.strictEqual(childrenCount, 0);
            }).then(done, done);
        });
    });

    it("should create parent when association is also made using HasMany", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelParent.hasMany(ModelChild);
        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return ModelParent.find(child.ModelParentId).then(function (modelParent) {
                    return child.getModelParent().then(function (parent) {
                        assert.strictEqual(parent.Model.name, ModelParent.name);
                        assert.strictEqual(parent.Model.name, modelParent.Model.name);
                        assert.strictEqual(parent.id, modelParent.id);

                        return true;
                    });
                });
            });
        }).then(assert.ok).then(done, done); // assert.ok gets the true returned above, to make sure all assert.strictEquals were run
    });

    it("should create parent when association is also made using HasOne", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelParent.hasOne(ModelChild);
        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                return ModelParent.find(child.ModelParentId).then(function (modelParent) {
                    return child.getModelParent().then(function (parent) {
                        assert.strictEqual(parent.Model.name, ModelParent.name);
                        assert.strictEqual(parent.Model.name, modelParent.Model.name);
                        assert.strictEqual(parent.id, modelParent.id);

                        return true;
                    });
                });
            });
        }).then(assert.ok).then(done, done); // assert.ok gets the true returned above
    });

    it("should add a generator attribute with parent instances", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelMother = sequelize.define("ModelMother", {});

        ModelChild.belongsTo(ModelParent);
        ModelChild.belongsTo(ModelMother);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                assert.ok(_.has(child, "generator"));

                assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
                assert.strictEqual(child.generator.ModelMother.Model.name, ModelMother.name);

                return true;
            });
        }).then(assert.ok).then(done, done); // assert.ok gets the true returned above
    });

    it("should add a generator attribute with parent and grandparent instances", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {});

        ModelChild.belongsTo(ModelParent);
        ModelParent.belongsTo(ModelGrandParent);

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                assert.ok(_.has(child, "generator"));

                assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
                assert.strictEqual(child.generator.ModelParent.generator.ModelGrandParent.Model.name, ModelGrandParent.name);

                return true;
            });
        }).then(assert.ok).then(done, done); // assert.ok gets the true returned above
    });

    it("should populate generator attribute for both parents, and 4 grandparents (paternal and maternal)", function (done) {
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
                assert.strictEqual(child.generator.ModelFather.Model.name, ModelFather.name);
                assert.strictEqual(child.generator.ModelMother.Model.name, ModelMother.name);

                assert.strictEqual(child.generator.ModelFather.generator.ModelPaternalGrandFather.Model.name, ModelPaternalGrandFather.name);
                assert.strictEqual(child.generator.ModelFather.generator.ModelPaternalGrandMother.Model.name, ModelPaternalGrandMother.name);

                assert.strictEqual(child.generator.ModelMother.generator.ModelMaternalGrandFather.Model.name, ModelMaternalGrandFather.name);
                assert.strictEqual(child.generator.ModelMother.generator.ModelMaternalGrandMother.Model.name, ModelMaternalGrandMother.name);
            });
        }).then(done, done);
    });

    it("should populate field with url if required by its validation", function (done) {
        var ModelChild = sequelize.define("ModelChild", {
            url: {
                type: Sequelize.TEXT,
                validate: {
                    isUrl: true
                }
            }
        });

        sync().then(function () {
            return new SequelizeG(ModelChild).then(function (child) {
                assert.strictEqual(child.url.indexOf("http://"), 0);
            });
        }).then(done, done);
    });

    it("should stop creating parents if option is set", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {});

        ModelChild.belongsTo(ModelParent);
        ModelParent.belongsTo(ModelGrandParent);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                ModelGrandParent: null
            }).then(function (child) {
                assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
                assert.strictEqual(child.generator.ModelParent.generator.ModelGrandParent, undefined);

                return child.getModelParent();
            }).then(function (parent) {
                return parent.getModelGrandParent();
            }).then(function (grandParent) {
                assert.strictEqual(grandParent, null);
            });
        }).then(done, done);
    });

    it("should create as many instances, without any parent, as set in options", function (done) {
        var Model = sequelize.define("Model", {}),
            number = 7;

        sync().then(function () {
            return new SequelizeG(Model, {
                number: number
            }).then(function (children) {
                // Children has number elements
                assert.strictEqual(number, children.length);

                // Each child is an instance of Model
                children.forEach(function (child) {
                    assert.strictEqual(child.Model.name, Model.name);
                });

                // Children ids are 1..7
                assert.deepEqual(_.map(children, "id"), _.range(1, number + 1));
            });
        }).then(done, done);
    });

    it("should create as many instances, with its parent, as set in options", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            number = 7;

        ModelChild.belongsTo(ModelParent);
        ModelParent.hasMany(ModelChild);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                number: number
            }).then(function (children) {
                // Children has number elements
                assert.strictEqual(number, children.length);

                // Each child is an instance of Model
                children.forEach(function (child) {
                    assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
                });

                // Children ids are 1..7
                assert.deepEqual(_.map(children, "id"), _.range(1, number + 1));
            });
        }).then(done, done);
    });

    it("should create as many instances, with its parent, but not one of its grandparents, as set in options", function (done) {
        // That means one parent for 2 children, but just one grandparent
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelPaternalGrandFather = sequelize.define("ModelPaternalGrandFather", {}),
            ModelPaternalGrandMother = sequelize.define("ModelPaternalGrandMother", {});

        ModelChild.belongsTo(ModelParent);

        ModelParent.belongsTo(ModelPaternalGrandFather);
        ModelParent.belongsTo(ModelPaternalGrandMother);

        sync().then(function () {
            return new SequelizeG(ModelChild, {
                number: 2,
                ModelPaternalGrandFather: null
            }).then(function (children) {
                var childA = children[0],
                    childB = children[1];

                assert.strictEqual(childB.generator.ModelParent.generator.ModelPaternalGrandMother.Model.name, ModelPaternalGrandMother.name);
                assert.strictEqual(childA.generator.ModelParent.generator.ModelPaternalGrandFather, undefined);
            });
        }).then(done, done);
    });

    it("should create as many instances, and set an existing parent, as set in options", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {});

        ModelChild.belongsTo(ModelParent);

        sync().then(function () {
            return ModelParent.create();
        }).then(function (parent) {
            return new SequelizeG(ModelChild, {
                number: 2,
                attributes: {
                    ModelParentId: parent.id
                }
            }).then(function (children) {
                return ModelParent.count().then(function (parentCount) {
                    assert.strictEqual(parentCount, 1); // Just to make sure number: 2 did not create more than one parent

                    return children;
                });
            }).then(function (children) {
                var childA = children[0],
                    childB = children[1];

                assert.strictEqual(childA.generator.ModelParent.id, parent.id);
                assert.strictEqual(childB.generator.ModelParent.id, parent.id);

                assert.notStrictEqual(childA.id, childB.id);
            });
        }).then(done, done);
    });

    it("should create as many instances, set an existing parent, and stop at grandparent, as set in options", function (done) {
        var ModelChild = sequelize.define("ModelChild", {}),
            ModelParent = sequelize.define("ModelParent", {}),
            ModelGrandParent = sequelize.define("ModelGrandParent", {});

        ModelChild.belongsTo(ModelParent);

        ModelParent.belongsTo(ModelGrandParent);

        sync().then(function () {
            return new SequelizeG(ModelParent); // This should create ModelChild's GrandFather, per previous tests
        }).then(function (parent) {
            return ModelGrandParent.findAndCountAll().then(function (result) {
                // Make sure only one GrandParent exists at the database
                assert.strictEqual(result.count, 1);

                var grandParent = result.rows[0];

                return new SequelizeG(ModelChild, {
                    number: 2,
                    ModelGrandParent: null,
                    attributes: {
                        ModelParentId: parent.id
                    }
                }).then(function (children) {
                    var childA = children[0],
                        childB = children[1];

                    // They share the same parent
                    assert.strictEqual(childA.generator.ModelParent.id, parent.id);
                    assert.strictEqual(childB.generator.ModelParent.id, parent.id);

                    assert.notStrictEqual(childA.id, childB.id);

                    return childA.generator.ModelParent.getModelGrandParent().then(function (childAGrandParent) {
                        assert.strictEqual(childAGrandParent.id, grandParent.id); // Child's grandParent is its parent's parent

                        return childB.generator.ModelParent.getModelGrandParent();
                    }).then(function (childBGrandParent) {
                        assert.strictEqual(childBGrandParent.id, grandParent.id); // Child's grandParent is its parent's parent
                    });
                });
            });
        }).then(done, done);
    });
});
