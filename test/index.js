require('dotenv').config();

const _ = require('lodash');
const Sequelize = require('sequelize');
const assert = require('assert');
const when = require('when');
const SequelizeG = require('../index.js');

const sequelize = new Sequelize('myapp_test',
  process.env.DB_USERNAME,
  '', {
    dialect: 'mysql',
    logging: false,
    port: process.env.DB_PORT,
  });

describe('Sequelize generator', () => {
  afterEach(() => {
    // Undo the model definition or it hangs on the sequelize object, infecting
    // subsequent tests
    const daoNames = _.map(sequelize.daoFactoryManager.daos, 'name');

    daoNames.forEach((daoName) => {
      sequelize.daoFactoryManager.removeDAO(sequelize.daoFactoryManager.getDAO(daoName));
    });
  });

  const sync = function sync() {
    return sequelize.getQueryInterface().dropAllTables().then(() => sequelize.sync({
      force: true,
    }));
  };

  it('should instantiate a model without relationships', () => {
    const ModelWithoutRelationship = sequelize.define('modelWithoutRelationship', {});

    return sync().then(() => new SequelizeG(ModelWithoutRelationship).then((modelChild) => {
      assert.strictEqual(modelChild.Model.name, ModelWithoutRelationship.name);
    }));
  });

  it('should instantiate a child model and automatically the parent it belongs to', () => {
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelChild = sequelize.define('ModelChild', {});

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => child.getModelParent()).then((parent) => {
        assert.strictEqual(parent.Model.name, ModelParent.name);
      }));
  });

  it('should instantiate a child model and automatically the multiple parents it belongs to', (done) => {
    const ModelChild = sequelize.define('ModelChild', {});
    const parentModels = new Array(10);
    const parentModelsLength = parentModels.length;

    for (let i = 0; i < parentModelsLength; i += 1) {
      const ModelParent = sequelize.define(`ModelParent${i}`, {});

      parentModels[i] = ModelParent;

      ModelChild.belongsTo(ModelParent);
    }

    sync().then(() => new SequelizeG(ModelChild).then((child) => when.all(parentModels.map((ParentModel, i) => child[`getModelParent${i}`]().then((parentI) => {
      assert.strictEqual(parentI.Model.name, parentModels[i].name);

      return i; // Used as a counter on the length assert below
    }))))).then((is) => {
      assert.strictEqual(parentModelsLength, is.length);
      done();
    }, done);
  });

  it('should instantiate a child model, its parent, and its grandparent', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {});

    ModelChild.belongsTo(ModelParent);
    ModelParent.belongsTo(ModelGrandParent);

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => child.getModelParent()
        .then((parent) => {
          assert.strictEqual(parent.Model.name, ModelParent.name);

          return parent;
        })).then((parent) => parent.getModelGrandParent().then((grandParent) => {
        assert.strictEqual(grandParent.Model.name, ModelGrandParent.name);
      })));
  });

  it('should instantiate a child model, and several of its ancestor generations', (done) => {
    const modelsGenerations = [sequelize.define('Model0', {})];
    const additionalModelsNumber = 9;

    for (let i = 1; i < additionalModelsNumber + 1; i += 1) {
      const Model = sequelize.define(`Model${i}`, {});
      const previousModel = modelsGenerations[i - 1];

      modelsGenerations[i] = Model;

      previousModel.belongsTo(Model);
    }

    sync().then(() => new SequelizeG(modelsGenerations[0])
      .then((model0) => when.reduce(modelsGenerations, (currentResult, value, index, total) => {
        if (index < total - 1) {
          assert.strictEqual(currentResult.Model.name, value.name);
          return currentResult[`getModel${index + 1}`]();
        }
        return total;
      }, model0))).then((total) => {
      assert.strictEqual(additionalModelsNumber + 1, total);
      done();
    }, done);
  });

  it('should instantiate a child model, both parents, and 4 grandparents (paternal and maternal)', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelFather = sequelize.define('ModelFather', {});
    const ModelMother = sequelize.define('ModelMother', {});
    const ModelPaternalGrandFather = sequelize.define('ModelPaternalGrandFather', {});
    const ModelPaternalGrandMother = sequelize.define('ModelPaternalGrandMother', {});
    const ModelMaternalGrandFather = sequelize.define('ModelMaternalGrandFather', {});
    const ModelMaternalGrandMother = sequelize.define('ModelMaternalGrandMother', {});

    ModelChild.belongsTo(ModelFather);
    ModelChild.belongsTo(ModelMother);

    ModelFather.belongsTo(ModelPaternalGrandFather);
    ModelFather.belongsTo(ModelPaternalGrandMother);

    ModelMother.belongsTo(ModelMaternalGrandFather);
    ModelMother.belongsTo(ModelMaternalGrandMother);

    return sync().then(() => new SequelizeG(ModelChild).then((childA) => (
    // Check father and paternal grandparents
      childA.getModelFather().then((father) => {
        assert.strictEqual(father.Model.name, ModelFather.name);
        return father.getModelPaternalGrandFather().then((paternalGrandFather) => {
          assert.strictEqual(paternalGrandFather.Model.name, ModelPaternalGrandFather.name);

          return father.getModelPaternalGrandMother();
        }).then((paternalGrandMother) => {
          assert.strictEqual(paternalGrandMother.Model.name, ModelPaternalGrandMother.name);

          return childA;
        });
      }).then((childB) => (
        // Check mother and maternal grandparents
        childB.getModelMother().then((mother) => {
          assert.strictEqual(mother.Model.name, ModelMother.name);

          return mother.getModelMaternalGrandFather().then((maternalGrandFather) => {
            assert.strictEqual(maternalGrandFather.Model.name, ModelMaternalGrandFather.name);

            return mother.getModelMaternalGrandMother();
          }).then((maternalGrandMother) => {
            assert.strictEqual(maternalGrandMother.Model.name, ModelMaternalGrandMother.name);

            return null;
          });
        }))))));
  });

  it('should set attributes for Model', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
    });

    return sync().then(() => new SequelizeG(Model, {
      attributes: {
        name: 'Julio Nobrega Netto',
      },
    }).then((child) => {
      assert.strictEqual(child.name, 'Julio Nobrega Netto');
    }));
  });

  it('should set attributes for parent model', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {
      name: Sequelize.STRING,
    });

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild, {
      ModelParent: {
        attributes: {
          name: 'José Nobrega Netto',
        },
      },
    }).then((child) => child.getModelParent()).then((parent) => {
      assert.strictEqual(parent.name, 'José Nobrega Netto');
    }));
  });

  it('should set attributes for grandparent model', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {
      name: Sequelize.STRING,
    });

    ModelChild.belongsTo(ModelParent);
    ModelParent.belongsTo(ModelGrandParent);

    return sync().then(() => new SequelizeG(ModelChild, {
      ModelGrandParent: {
        attributes: {
          name: 'Julio Nobrega', // notice the lack of Netto
        },
      },
    })
      .then((child) => child.getModelParent())
      .then((parent) => parent.getModelGrandParent())
      .then((grandParent) => {
        assert.strictEqual(grandParent.name, 'Julio Nobrega');
      }));
  });

  it('should not populate INTEGER on child and parents if set as attributes', () => {
    const childNumber = _.parseInt(_.uniqueId(), 10);
    const parentNumber = _.parseInt(_.uniqueId(), 10);
    const ModelChild = sequelize.define('ModelChild', {
      number: Sequelize.INTEGER,
    });
    const ModelParent = sequelize.define('ModelParent', {
      number: Sequelize.INTEGER,
    });

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild, {
      attributes: {
        number: childNumber,
      },
      ModelParent: {
        attributes: {
          number: parentNumber,
        },
      },
    }).then((child) => {
      assert.strictEqual(child.number, childNumber);
      return child.getModelParent();
    }).then((parent) => {
      assert.strictEqual(parent.number, parentNumber);
    }));
  });

  it('should populate fields when the column is specified as an object', () => {
    const Model = sequelize.define('Model', {
      number1: Sequelize.INTEGER,
      number2: {
        type: Sequelize.INTEGER,
      },
    });

    return sync().then(() => new SequelizeG(Model).then((model) => {
      assert.ok(_.isNumber(model.number1));
      assert.ok(_.isNumber(model.number2));
    }));
  });

  it('should populate field with null if specified as an attribute', () => {
    const Model = sequelize.define('Model', {
      number: Sequelize.INTEGER,
    });

    return sync().then(() => new SequelizeG(Model, {
      attributes: {
        number: null,
      },
    }).then((model) => {
      assert.ok(_.isNull(model.number));
    }));
  });

  it('should accept as an attribute a foreign key of an already created instance', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => ModelParent.create()).then((parent) => new SequelizeG(ModelChild, {
      attributes: {
        ModelParentId: parent.id,
      },
    }).then((child) => {
      assert.strictEqual(parent.id, child.ModelParentId);
    }));
  });

  it('should accept as an attribute an array that is consumed each time an instance is created', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
    });
    const names = ['Julio', 'Gustavo', 'Felipe'];

    return sync().then(() => new SequelizeG(Model, {
      number: 3,
      attributes: {
        name: names,
      },
    }).then((children) => {
      assert.deepStrictEqual(_.map(children, 'name'), names);
    }));
  });

  it('should accept as attributes arrays that are consumed each time an instance is created', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
      profession: Sequelize.STRING,
    });
    const names = ['Julio', 'Gustavo', 'Felipe'];
    const professions = ['Programmer', 'Producer', 'Chef'];

    return sync().then(() => new SequelizeG(Model, {
      number: 3,
      attributes: {
        name: names,
        profession: professions,
      },
    }).then((children) => {
      assert.deepStrictEqual(_.map(children, 'name'), names);
      assert.deepStrictEqual(_.map(children, 'profession'), professions);
    }));
  });

  it('should accept as an attribute an array of foreign keys that are consumed each time an instance is created', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelParent, {
      number: 2,
    })).then((parents) => new SequelizeG(ModelChild, {
      number: 2,
      attributes: {
        ModelParentId: _.map(parents, 'id'),
      },
    }).then((children) => {
      assert.deepStrictEqual(_.map(children, 'ModelParentId'), _.map(parents, 'id'));
    }));
  });

  it('should accept as an attribute a function that returns the value to be set', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
    });
    const name = 'Julio';

    return sync().then(() => new SequelizeG(Model, {
      attributes: {
        name() {
          return name;
        },
      },
    }).then((instance) => {
      assert.strictEqual(name, instance.name);
    }));
  });

  it('should accept as an attribute a function that returns the value to be set, even for multiple instances', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
    });
    const name = 'Julio';

    return sync().then(() => new SequelizeG(Model, {
      number: 2,
      attributes: {
        name() {
          return name;
        },
      },
    }).then((instance) => {
      assert.strictEqual(name, instance[0].name);
      assert.strictEqual(name, instance[1].name);
    }));
  });

  it('should create instances with a shared foreign key, if option is set', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelFather = sequelize.define('ModelFather', {});
    const ModelMother = sequelize.define('ModelMother', {});
    const ModelCommonAncestor = sequelize.define('ModelCommonAncestor', {});

    ModelChild.belongsTo(ModelFather);
    ModelChild.belongsTo(ModelMother);

    ModelFather.belongsTo(ModelCommonAncestor);
    ModelMother.belongsTo(ModelCommonAncestor);

    return sync().then(() => new SequelizeG(ModelChild, {
      ModelCommonAncestor: 'shared',
    }).then((child) => {
      const childModelFather = child.generator.ModelFather;
      const childModelMother = child.generator.ModelMother;

      assert.notStrictEqual(childModelFather.ModelCommonAncestorId, null);
      assert.strictEqual(
        childModelFather.ModelCommonAncestorId,
        childModelMother.ModelCommonAncestorId,
      );
    }));
  });

  it('should create instances with a shared foreign key, if option is set, even for multiple number', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild, {
      number: 2,
      ModelParent: 'shared',
    }).then((children) => {
      const children0Id = children[0].generator.ModelParent.values.id;
      const children1Id = children[1].generator.ModelParent.values.id;

      assert.strictEqual(children0Id, children1Id);
    }));
  });

  it('should create record with NULL on fields that reference parents when foreignKeyConstraint is true', () => {
    // Only the creation gets NULL. SequelizeG later calls instance.setModelParent(parentInstance)
    // which will replace NULL by parentInstance primary key
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelChild.belongsTo(ModelParent, {
      foreignKeyConstraint: true,
    });

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => child.getModelParent()
        .then((parent) => {
          assert.strictEqual(child.ModelParentId, parent.id);
          assert.strictEqual(parent.Model.name, ModelParent.name);
        })));
  });

  it('should set parent model when association has "as" option', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelChild.belongsTo(ModelParent, {
      foreignKey: 'ModelParentId',
      as: 'someName',
    });

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => child.getSomeName())
      .then((parent) => {
        assert.strictEqual(parent.Model.name, ModelParent.name);
      }));
  });

  it('should set parent and grandparent model when associations have "as" option', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {});

    ModelChild.belongsTo(ModelParent, {
      foreignKey: 'ModelParentId',
      as: 'someName',
    });

    ModelParent.belongsTo(ModelGrandParent, {
      foreignKey: 'ModelGrandParentId',
      as: 'someOtherName',
    });

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => child.getSomeName())
      .then((parent) => parent.getSomeOtherName())
      .then((grandParent) => {
        assert.strictEqual(grandParent.Model.name, ModelGrandParent.name);
      }));
  });

  it('should only create parents, not children', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {});

    ModelChild.belongsTo(ModelParent);

    ModelParent.belongsTo(ModelGrandParent);

    return sync().then(() => new SequelizeG(ModelParent)
      .then(() => ModelGrandParent.count())
      .then((grandParentCount) => {
        assert.strictEqual(grandParentCount, 1);
      }).then(() => ModelChild.count())
      .then((childrenCount) => {
        assert.strictEqual(childrenCount, 0);
      }));
  });

  it('should create parent when association is also made using HasMany', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelParent.hasMany(ModelChild);
    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => ModelParent.find(child.ModelParentId)
        .then((modelParent) => child.getModelParent()
          .then((parent) => {
            assert.strictEqual(parent.Model.name, ModelParent.name);
            assert.strictEqual(parent.Model.name, modelParent.Model.name);
            assert.strictEqual(parent.id, modelParent.id);

            return true;
          })))).then(assert.ok);
  });

  it('should create parent when association is also made using HasOne', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelParent.hasOne(ModelChild);
    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => ModelParent.find(child.ModelParentId)
        .then((modelParent) => child.getModelParent().then((parent) => {
          assert.strictEqual(parent.Model.name, ModelParent.name);
          assert.strictEqual(parent.Model.name, modelParent.Model.name);
          assert.strictEqual(parent.id, modelParent.id);

          return true;
        })))).then(assert.ok);
  });

  it('should add a generator attribute with parent instances', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelMother = sequelize.define('ModelMother', {});

    ModelChild.belongsTo(ModelParent);
    ModelChild.belongsTo(ModelMother);

    return sync().then(() => new SequelizeG(ModelChild).then((child) => {
      assert.ok(_.has(child, 'generator'));

      assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
      assert.strictEqual(child.generator.ModelMother.Model.name, ModelMother.name);

      return true;
    })).then(assert.ok);
  });

  it('should add a generator attribute with parent and grandparent instances', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {});

    ModelChild.belongsTo(ModelParent);
    ModelParent.belongsTo(ModelGrandParent);

    return sync().then(() => new SequelizeG(ModelChild).then((child) => {
      assert.ok(_.has(child, 'generator'));

      const childModelParent = child.generator.ModelParent;
      const childModelGrandParentName = childModelParent.generator.ModelGrandParent.Model.name;

      assert.strictEqual(childModelParent.Model.name, ModelParent.name);
      assert.strictEqual(childModelGrandParentName, ModelGrandParent.name);

      return true;
    })).then(assert.ok);
  });

  it('should populate generator attribute for both parents, and 4 grandparents (paternal and maternal)', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelFather = sequelize.define('ModelFather', {});
    const ModelMother = sequelize.define('ModelMother', {});
    const ModelPaternalGrandFather = sequelize.define('ModelPaternalGrandFather', {});
    const ModelPaternalGrandMother = sequelize.define('ModelPaternalGrandMother', {});
    const ModelMaternalGrandFather = sequelize.define('ModelMaternalGrandFather', {});
    const ModelMaternalGrandMother = sequelize.define('ModelMaternalGrandMother', {});

    ModelChild.belongsTo(ModelFather);
    ModelChild.belongsTo(ModelMother);

    ModelFather.belongsTo(ModelPaternalGrandFather);
    ModelFather.belongsTo(ModelPaternalGrandMother);

    ModelMother.belongsTo(ModelMaternalGrandFather);
    ModelMother.belongsTo(ModelMaternalGrandMother);

    return sync().then(() => new SequelizeG(ModelChild).then((child) => {
      assert.strictEqual(child.generator.ModelFather.Model.name, ModelFather.name);
      assert.strictEqual(child.generator.ModelMother.Model.name, ModelMother.name);

      const ModelFatherGenerator = child.generator.ModelFather.generator;

      assert.strictEqual(
        ModelFatherGenerator.ModelPaternalGrandFather.Model.name,
        ModelPaternalGrandFather.name,
      );
      assert.strictEqual(
        ModelFatherGenerator.ModelPaternalGrandMother.Model.name,
        ModelPaternalGrandMother.name,
      );

      const ModelMotherGenerator = child.generator.ModelMother.generator;

      assert.strictEqual(
        ModelMotherGenerator.ModelMaternalGrandFather.Model.name,
        ModelMaternalGrandFather.name,
      );
      assert.strictEqual(
        ModelMotherGenerator.ModelMaternalGrandMother.Model.name,
        ModelMaternalGrandMother.name,
      );
    }));
  });

  it('should populate field with url if required by its validation', () => {
    const ModelChild = sequelize.define('ModelChild', {
      url: {
        type: Sequelize.TEXT,
        validate: {
          isUrl: true,
        },
      },
    });

    return sync().then(() => new SequelizeG(ModelChild).then((child) => {
      assert.strictEqual(child.url.indexOf('http://'), 0);
    }));
  });

  it('should stop creating parents if option is set', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {});

    ModelChild.belongsTo(ModelParent);
    ModelParent.belongsTo(ModelGrandParent);

    return sync().then(() => new SequelizeG(ModelChild, {
      ModelGrandParent: null,
    }).then((child) => {
      assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
      assert.strictEqual(child.generator.ModelParent.generator.ModelGrandParent, undefined);

      return child.getModelParent();
    }).then((parent) => parent.getModelGrandParent()).then((grandParent) => {
      assert.strictEqual(grandParent, null);
    }));
  });

  it('should create as many instances, without any parent, as set in options', () => {
    const Model = sequelize.define('Model', {});
    const number = 7;

    return sync().then(() => new SequelizeG(Model, {
      number,
    }).then((children) => {
      // Children has number elements
      assert.strictEqual(number, children.length);

      // Each child is an instance of Model
      children.forEach((child) => {
        assert.strictEqual(child.Model.name, Model.name);
      });

      // Children ids are 1..7
      assert.deepEqual(_.map(children, 'id'), _.range(1, number + 1));
    }));
  });

  it('should create as many instances, with its parent, as set in options', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const number = 7;

    ModelChild.belongsTo(ModelParent);
    ModelParent.hasMany(ModelChild);

    return sync().then(() => new SequelizeG(ModelChild, {
      number,
    }).then((children) => {
      // Children has number elements
      assert.strictEqual(number, children.length);

      // Each child is an instance of Model
      children.forEach((child) => {
        assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
      });

      // Children ids are 1..7
      assert.deepStrictEqual(_.map(children, 'id'), _.range(1, number + 1));
    }));
  });

  it('should create as many instances, with its parent, but not one of its grandparents, as set in options', () => {
    // That means one parent for 2 children, but just one grandparent
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelPaternalGrandFather = sequelize.define('ModelPaternalGrandFather', {});
    const ModelPaternalGrandMother = sequelize.define('ModelPaternalGrandMother', {});

    ModelChild.belongsTo(ModelParent);

    ModelParent.belongsTo(ModelPaternalGrandFather);
    ModelParent.belongsTo(ModelPaternalGrandMother);

    return sync().then(() => new SequelizeG(ModelChild, {
      number: 2,
      ModelPaternalGrandFather: null,
    }).then((children) => {
      const childA = children[0];
      const childB = children[1];

      const childAName = childA.generator.ModelParent.generator.ModelPaternalGrandFather;
      const childBName = childB.generator.ModelParent.generator.ModelPaternalGrandMother.Model.name;

      assert.strictEqual(childBName, ModelPaternalGrandMother.name);
      assert.strictEqual(childAName, undefined);
    }));
  });

  it('should create as many instances, and set an existing parent, as set in options', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => ModelParent.create()).then((parent) => new SequelizeG(ModelChild, {
      number: 2,
      attributes: {
        ModelParentId: parent.id,
      },
    }).then((children) => ModelParent.count().then((parentCount) => {
      // Just to make sure number: 2 did not create more than one parent
      assert.strictEqual(parentCount, 1);

      return children;
    })).then((children) => {
      const childA = children[0];
      const childB = children[1];

      assert.strictEqual(childA.generator.ModelParent.id, parent.id);
      assert.strictEqual(childB.generator.ModelParent.id, parent.id);

      assert.notStrictEqual(childA.id, childB.id);
    }));
  });

  it('should create as many instances, set an existing parent, and stop at grandparent, as set in options', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {});
    const ModelGrandParent = sequelize.define('ModelGrandParent', {});

    ModelChild.belongsTo(ModelParent);

    ModelParent.belongsTo(ModelGrandParent);

    // This should create ModelChild's GrandFather, per previous tests
    return sync().then(() => new SequelizeG(ModelParent))
      .then((parent) => ModelGrandParent.findAndCountAll().then((result) => {
      // Make sure only one GrandParent exists at the database
        assert.strictEqual(result.count, 1);

        const grandParent = result.rows[0];

        return new SequelizeG(ModelChild, {
          number: 2,
          ModelGrandParent: null,
          attributes: {
            ModelParentId: parent.id,
          },
        }).then((children) => {
          const childA = children[0];
          const childB = children[1];

          // They share the same parent
          assert.strictEqual(childA.generator.ModelParent.id, parent.id);
          assert.strictEqual(childB.generator.ModelParent.id, parent.id);

          assert.notStrictEqual(childA.id, childB.id);

          return childA.generator.ModelParent.getModelGrandParent().then((childAGrandParent) => {
          // Child's grandParent is its parent's parent
            assert.strictEqual(childAGrandParent.id, grandParent.id);

            return childB.generator.ModelParent.getModelGrandParent();
          }).then((childBGrandParent) => {
          // Child's grandParent is its parent's parent
            assert.strictEqual(childBGrandParent.id, grandParent.id);
          });
        });
      }));
  });
});
