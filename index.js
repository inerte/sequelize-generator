"use strict";

var _ = require("lodash"),
    Sequelize = require("sequelize"),
    when = require("when");

module.exports = function G(sequelizeModelOrInstance, options) {
    options = options || {
        attributes: {}
    };

    function valueBasedOnAttribute(attribute) {
        var typeString;

        if (attribute.type) {
            typeString = attribute.type.toString();
        } else {
            typeString = attribute;
        }

        if (typeString === "ENUM") {
            return _.sample(attribute.values);
        } else if (_.contains(["INTEGER", "SMALLINT UNSIGNED"], typeString)) {
            return _.parseInt(_.uniqueId(), 10);
            // starts with VARCHAR( or CHAR(, or is TEXT
        } else if (typeString.indexOf("VARCHAR(") === 0 || typeString.indexOf("CHAR") === 0 || typeString === "TEXT") {
            if (attribute.isUrl) {
                return "http://example.com/" + _.uniqueId()
            } else {
                return _.uniqueId();
            }
        }

        return null;
    }

    function setDefaultAttributesValue(rawAttributes, customValues) {
        var attributes = customValues || {};

        _(rawAttributes)
        // Removes from rawAttributes any attributes from customValues. We want user-passed values to take precedence
        .omit(_.keys(customValues))
        // Loop the remaining rawAttributes to set values according to its Sequelize data type
        .forEach(function (value, key) {
            if (!_.has(value, "autoIncrement") && value.autoIncrement !== true) {
                if (_.has(value, "references")) {
                    attributes[key] = null;
                } else {
                    var valueToPopulate = valueBasedOnAttribute(value);
                    if (!_.isNull(valueToPopulate)) {
                        attributes[key] = valueToPopulate;
                    }
                }
            }
        }).value();

        return attributes;
    }

    function instanceIfNeeded() {
        // It is a model, create the instance
        if (sequelizeModelOrInstance.tableName) {
            options.attributes = setDefaultAttributesValue(sequelizeModelOrInstance.rawAttributes, options.attributes);

            return sequelizeModelOrInstance.create(options.attributes);
        } else {
            // It is already an instance, not a model, so wrap it as a promise
            return when(sequelizeModelOrInstance);
        }
    }

    return instanceIfNeeded(sequelizeModelOrInstance).then(function (instance) {
        // Since G is recursive, options.rootInstance keeps track of what should be ultimately returned
        if (!options.rootInstance) {
            options.rootInstance = instance;
        }

        instance.generator = {};

        var associations = _.where(instance.daoFactory.associations, {
            associationType: "BelongsTo"
        });

        if (_.isEmpty(associations)) {
            return instance;
        } else {
            return when.all(_.map(associations, function (association) {
                var target = association.target,
                    targetAttributes = options[target.name] && options[target.name].attributes || {},
                    targetInstancePromise;

                targetAttributes = setDefaultAttributesValue(target.rawAttributes, targetAttributes);

                if (options[target.name] && options[target.name] === "any") {
                    targetInstancePromise = target.findAll().then(function (targetInstances) {
                        return _.sample(targetInstances);
                    });
                } else {
                    // If the target identifier was passed as an atribute of instance, try to get the
                    // existing record from the database. In other words, the foreign key value is set.
                    // Otherwise, create the instance.
                    targetInstancePromise = target.findOrCreate({
                        id: options.attributes[association.identifier] || null
                    }, targetAttributes);
                }

                return targetInstancePromise.then(function (targetInstance) {
                    var setterMethod;

                    if (association.accessors && association.accessors.set) {
                        setterMethod = instance[association.accessors.set];

                        if (association.associationType === "HasMany") {
                            targetInstance = [targetInstance];
                        }
                    } else {
                        // setterName code copied straight from Sequelize
                        // https://github.com/sequelize/sequelize/blob/0299ce638fc13ad79a50cd0714f274143babaf29/lib/associations/belongs-to.js#L71
                        var setterName = Sequelize.Utils._.camelize("set_" + (association.options.as || Sequelize.Utils.singularize(target.tableName, association.options.language)));

                        if (instance[setterName]) {
                            setterMethod = instance[setterName];
                        } else if (instance[setterName + "s"]) {
                            setterMethod = instance[setterName + "s"];
                        }
                    }

                    instance.generator[target.name] = targetInstance;

                    return setterMethod.call(instance, targetInstance).then(function () {
                        return targetInstance;
                    });
                });
            })).then(function (targetInstances) {
                return when.all(targetInstances.map(function (targetInstance) {
                    if (!_.isEmpty(targetInstance.daoFactory.associations)) {
                        return new G(targetInstance, options);
                    } else {
                        return targetInstance;
                    }
                }));
            }).then(function () {
                return options.rootInstance;
            });
        }
    });
};
