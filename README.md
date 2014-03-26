# Sequelize Generator [![Build Status](https://travis-ci.org/inerte/sequelize-generator.png)](https://travis-ci.org/inerte/sequelize-generator)
===================

Object instantiation for Sequelize models

sequelize-generator instantiates objects based on Sequelize relationships. You give a "child" model (or even great...n-grandchild) and sequelize-generator creates the whole chain of parents, making them easily accessible via the .generator attribute. It is perfect for tests! Instead of painstakingly creating a single model and then one of its parents, remembering to assign the proper id, and then another parent and the grandparent... you just run:

```js
var child = sequelizeG(ModelName);
```

Read more below about some of sequelize-generator options.

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
        assert.strictEqual(father.Model.name, ModelFather.name);
        return father.getModelPaternalGrandFather().then(function (paternalGrandFather) {
            assert.strictEqual(paternalGrandFather.Model.name, ModelPaternalGrandFather.name);

            return father.getModelPaternalGrandMother();
        }).then(function (paternalGrandMother) {
            assert.strictEqual(paternalGrandMother.Model.name, ModelPaternalGrandMother.name);

            return child;
        });
    }).then(function (child) {
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
```

Phew! That's a lot of promises. This is ok for production code, but for tests, where sequelize-generator is most useful, you have a faster way to access the parent instances:

```js
new SequelizeG(ModelChild).then(function (child) {
    assert.strictEqual(child.generator.ModelFather.Model.name, ModelFather.name);
    assert.strictEqual(child.generator.ModelMother.Model.name, ModelMother.name);

    assert.strictEqual(child.generator.ModelFather.generator.ModelPaternalGrandFather.Model.name, ModelPaternalGrandFather.name);
    assert.strictEqual(child.generator.ModelFather.generator.ModelPaternalGrandMother.Model.name, ModelPaternalGrandMother.name);

    assert.strictEqual(child.generator.ModelMother.generator.ModelMaternalGrandFather.Model.name, ModelMaternalGrandFather.name);
    assert.strictEqual(child.generator.ModelMother.generator.ModelMaternalGrandMother.Model.name, ModelMaternalGrandMother.name);
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
    assert.strictEqual(child.generator.ModelParent.Model.name, ModelParent.name);
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

    assert.strictEqual(childA.Model.name, Model.name);
    assert.strictEqual(childB.Model.name, Model.name);

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
