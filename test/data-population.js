const _ = require('lodash');
const Sequelize = require('sequelize');
const assert = require('assert');
const SequelizeG = require('../index.js');

const sequelize = new Sequelize('myapp_test',
  'root',
  '', {
    dialect: 'mysql',
    logging: false,
    port: process.env.DB_PORT,
  });

describe('Sequelize generator data type fields pre-population', () => {
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

  it('should populate INTEGER with integers on child model', () => {
    const Model = sequelize.define('Model', {
      number: Sequelize.INTEGER,
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.isNumber(instance.number));
    }));
  });

  it('should populate INTEGER with integers on parent models', () => {
    const ModelChild = sequelize.define('ModelChild', {});
    const ModelParent = sequelize.define('ModelParent', {
      number: Sequelize.INTEGER,
    });

    ModelChild.belongsTo(ModelParent);

    return sync().then(() => new SequelizeG(ModelChild)
      .then((child) => child.getModelParent())
      .then((parent) => {
        assert.ok(_.isNumber(parent.number));
      }));
  });

  it('should populate ENUM with any value from its possible values', () => {
    const possibleValues = ['Julio', 'José'];
    const Model = sequelize.define('Model', {
      name: {
        type: Sequelize.ENUM,
        values: possibleValues,
      },
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.includes(possibleValues, instance.name));
    }));
  });

  it('should populate STRING with random string', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.isString(instance.name));
      assert.ok(instance.name.length > 0);
    }));
  });

  it('should populate STRING(n) with random string', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING(42),
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.isString(instance.name));
      assert.ok(instance.name.length > 0);
    }));
  });

  it('should populate CHAR with random string', () => {
    const Model = sequelize.define('Model', {
      name: 'CHAR',
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.isString(instance.name));
      assert.ok(instance.name.length > 0);
    }));
  });

  it('should populate CHAR(n) with random string', () => {
    const Model = sequelize.define('Model', {
      name: 'CHAR(32)',
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.isString(instance.name));
      assert.ok(instance.name.length > 0);
    }));
  });

  it('should populate SMALLINT UNSIGNED with random number', () => {
    const Model = sequelize.define('Model', {
      number: 'SMALLINT UNSIGNED',
    });

    return sync().then(() => new SequelizeG(Model).then((instance) => {
      assert.ok(_.isNumber(instance.number));
    }));
  });

  it('should populate fields with unique characters when number option is set', () => {
    const Model = sequelize.define('Model', {
      name: Sequelize.STRING,
    });

    return sync().then(() => new SequelizeG(Model, {
      number: 2,
    }).then((instances) => {
      const instanceA = instances[0];
      const instanceB = instances[1];

      assert.notStrictEqual(instanceA.name, instanceB.name);
    }));
  });
});
