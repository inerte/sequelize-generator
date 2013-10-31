# Sequelize Generator [![Build Status](https://travis-ci.org/inerte/sequelize-generator.png)](https://travis-ci.org/inerte/sequelize-generator)
===================

Object instantiation for Sequelize models

Let's say you have some complicated relationships:

```js
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
```

You can, from ModelChild, create every parent level above:

```js
new SequelizeG(ModelChild).then(function (child) {
    return child.getModelFather().then(function (father) {
        assert.strictEqual(father.daoFactoryName, ModelFather.name);
        return father.getModelPaternalGrandFather().then(function (paternalGrandFather) {
            assert.strictEqual(paternalGrandFather.daoFactoryName, ModelPaternalGrandFather.name);

            return father.getModelPaternalGrandMother();
        }).then(function (paternalGrandMother) {
            assert.strictEqual(paternalGrandMother.daoFactoryName, ModelPaternalGrandMother.name);

            return child;
        });
    }).then(function (child) {
        return child.getModelMother().then(function (mother) {
            assert.strictEqual(mother.daoFactoryName, ModelMother.name);
            return mother.getModelMaternalGrandFather().then(function (maternalGrandFather) {
                assert.strictEqual(maternalGrandFather.daoFactoryName, ModelMaternalGrandFather.name);

                return mother.getModelMaternalGrandMother();
            }).then(function (maternalGrandMother) {
                assert.strictEqual(maternalGrandMother.daoFactoryName, ModelMaternalGrandMother.name);

                return null;
            });
        });
    });
});
```

Phew! That's a lot of promises. This is ok for production code, but for tests, where sequelize-generator is most useful, you have a faster way to access the parent instances:

```js
new SequelizeG(ModelChild).then(function (child) {
    assert.strictEqual(child.generator.ModelFather.daoFactoryName, ModelFather.name);
    assert.strictEqual(child.generator.ModelMother.daoFactoryName, ModelMother.name);

    assert.strictEqual(child.generator.ModelFather.generator.ModelPaternalGrandFather.daoFactoryName, ModelPaternalGrandFather.name);
    assert.strictEqual(child.generator.ModelFather.generator.ModelPaternalGrandMother.daoFactoryName, ModelPaternalGrandMother.name);

    assert.strictEqual(child.generator.ModelMother.generator.ModelMaternalGrandFather.daoFactoryName, ModelMaternalGrandFather.name);
    assert.strictEqual(child.generator.ModelMother.generator.ModelMaternalGrandMother.daoFactoryName, ModelMaternalGrandMother.name);
});
```

You can tell sequelize-generator to stop creating parents with {ModelName: null}. See test "should stop creating parents if option is set":

```js
var ModelChild = sequelize.define("ModelChild", {}),
    ModelParent = sequelize.define("ModelParent", {}),
    ModelGrandParent = sequelize.define("ModelGrandParent", {});

    ModelChild.belongsTo(ModelParent);
    ModelParent.belongsTo(ModelGrandParent);

new SequelizeG(ModelChild, {
    ModelGrandParent: null
}).then(function (child) {
    assert.strictEqual(child.generator.ModelParent.daoFactoryName, ModelParent.name);
    assert.strictEqual(child.generator.ModelParent.generator.ModelGrandParent, undefined);
});
```

You can tell sequelize-generator to generate several instances (an array will be returned):

```js
var Model = sequelize.define("Model", {});

new SequelizeG(Model, {
    number: 2
}).then(function (children) {
    var childA = children[0],
        childB = children[1];

    assert.strictEqual(2, children.length);

    assert.strictEqual(childA.daoFactoryName, Model.name);
    assert.strictEqual(childB.daoFactoryName, Model.name);

    assert.notStrictEqual(childA.id, childB.id);
});
```

You can set attribute values for each of the several instances:

```js
var Model = sequelize.define("Model", {
        name: Sequelize.STRING
    }),
    names = ["Julio", "Gustavo", "Felipe"];

new SequelizeG(Model, {
    number: 3,
    attributes: {
        name: names
    }
}).then(function (children) {
    assert.deepEqual(_.pluck(children, "name"), names);
});
```

You can set an attribute value by passing a function:

```js
var Model = sequelize.define("Model", {
        name: Sequelize.STRING
    }),
    name = "Julio";

new SequelizeG(Model, {
    attributes: {
        name: function () {
            return name;
        }
    }
}).then(function (instance) {
    assert.strictEqual(name, instance.name);
});
```

If you want every instance to share a common ancestor, pass {ModelName: "shared"} as an option. See test "should create instances with a shared foreign key, if option is set". The shared option will try to use the first record of ModelName. If one is not found, it will be created, and then found when the second
instance attempts to use the shared common ancestor.
