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
        assert.ok(father.daoFactoryName === ModelFather.name);
        return father.getModelPaternalGrandFather().then(function (paternalGrandFather) {
            assert.ok(paternalGrandFather.daoFactoryName === ModelPaternalGrandFather.name);

            return father.getModelPaternalGrandMother();
        }).then(function (paternalGrandMother) {
            assert.ok(paternalGrandMother.daoFactoryName === ModelPaternalGrandMother.name);

            return child;
        });
    }).then(function (child) {
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
```

Phew! That's a lot of promises. This is ok for production code, but for tests, where sequelize-generator is most useful, you have a faster way to access the parent instances:

```js
new SequelizeG(ModelChild).then(function (child) {
    assert.ok(child.generator.ModelFather.daoFactoryName === ModelFather.name);
    assert.ok(child.generator.ModelMother.daoFactoryName === ModelMother.name);

    assert.ok(child.generator.ModelFather.generator.ModelPaternalGrandFather.daoFactoryName === ModelPaternalGrandFather.name);
    assert.ok(child.generator.ModelFather.generator.ModelPaternalGrandMother.daoFactoryName === ModelPaternalGrandMother.name);

    assert.ok(child.generator.ModelMother.generator.ModelMaternalGrandFather.daoFactoryName === ModelMaternalGrandFather.name);
    assert.ok(child.generator.ModelMother.generator.ModelMaternalGrandMother.daoFactoryName === ModelMaternalGrandMother.name);
});
```

If you want a random, already created, record to be selected as parent, pass {ModelParent: "any"} as an option. See test "should set a foreign key to a random, already created record, if option is set".
