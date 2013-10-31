"use strict";

var _ = require("lodash"),
    Sequelize = require("sequelize"),
    guard = require("when/guard"),
    when = require("when");

module.exports = function G(sequelizeModelOrInstance, options) {
    options = _.merge({
        attributes: {},
        number: 1
    }, options);

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
            if (attribute.validate && attribute.validate.isUrl) {
                return "http://example.com/" + _.uniqueId();
            } else {
                return _.uniqueId();
            }
        }

        return null;
    }

    function setDefaultAttributesValue(rawAttributes, customValues, associationIdentifiers) {
        var attributes = _.clone(customValues);

        _(rawAttributes)
        // Removes from rawAttributes any attributes from customValues. We want user-passed values to take precedence
        .omit(_.keys(customValues))
        // Loop the remaining rawAttributes to set values according to its Sequelize data type
        .forEach(function (value, key) {
            if (!_.has(value, "autoIncrement") && value.autoIncrement !== true) {
                if (_.has(value, "references") || _.contains(associationIdentifiers, key)) {
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

    function instancesIfNeeded(sequelizeModelOrInstance) {
        // It is a model, create the instance
        if (sequelizeModelOrInstance.tableName) {
            var associationIdentifiers = _.pluck(sequelizeModelOrInstance.associations, "identifier"),
                bulkCreateArgument = [];

            for (var i = 0; i < options.number; i++) {
                var attributes = setDefaultAttributesValue(sequelizeModelOrInstance.rawAttributes, options.attributes, associationIdentifiers);

                _.forEach(options.attributes, function (value, key) {
                    if (_.isArray(value)) { // If value is an array, we consume the first element
                        attributes[key] = value[i];
                    } else if (_.isFunction(value)) { // If value is a function, execute it
                        attributes[key] = value();
                    }
                });

                bulkCreateArgument.push(attributes);
            }

            // Sadly .bulkCreate does not return the newly created instances. We need to .findAll, but since calling G() multiple times
            // could potentially run .findAll and return previously created records, we need to .slice with just the last options.number
            // elements
            return sequelizeModelOrInstance.bulkCreate(bulkCreateArgument).then(function () {
                return sequelizeModelOrInstance.findAll();
            }).then(function (instances) {
                return instances.slice(-options.number);
            });
        } else {
            // It is already an instance, not a model, so wrap it as a promise
            return when([sequelizeModelOrInstance]);
        }
    }

    return instancesIfNeeded(sequelizeModelOrInstance).then(function (instances) {
        var instance;

        if (options.number > 1) {
            var originalNumber = options.number;

            options.number = options.number - instances.length;

            return when.map(instances, function (instance) {
                var optionsCopy = _.clone(options);

                if (originalNumber > 0) {
                    // This part should be refactored with bulkCreateArgument.push's from instancesIfNeeded()
                    var attributes = {};

                    _.forEach(options.attributes, function (value, key) {
                        if (_.isArray(value)) { // If value is an array, we consume the first element
                            attributes[key] = value.shift();
                        } else if (_.isFunction(value)) { // If value is a function, execute it
                            attributes[key] = value();
                        } else {
                            attributes[key] = value;
                        }
                    });

                    optionsCopy.attributes = attributes;
                }

                return new G(instance, optionsCopy);
            });
        } else {
            instance = instances[0];
        }

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
            return when.map(associations, function (association) {
                var target = association.target,
                    targetAttributes = options[target.name] && options[target.name].attributes || {},
                    targetInstancePromise;

                var associationIdentifiers = _.pluck(target.associations, "identifier");

                targetAttributes = setDefaultAttributesValue(target.rawAttributes, targetAttributes, associationIdentifiers);

                if (options[target.name] && options[target.name] === "shared") {
                    targetInstancePromise = target.findAll().then(function (targetInstances) {
                        if (targetInstances.length === 0) {
                            return target.create(targetAttributes);
                        } else {
                            return _.first(targetInstances);
                        }
                    });
                } else if (options[target.name] === null) {
                    return;
                } else {
                    // If the target identifier was passed as an atribute of instance, try to get the
                    // existing record from the database. In other words, the foreign key value is set.
                    // Otherwise, create the instance.
                    targetInstancePromise = target.findOrCreate({
                        id: options.attributes[association.identifier] || null
                    }, targetAttributes);
                }

                return targetInstancePromise.then(function (targetInstance) {
                    var setterName = Sequelize.Utils._.camelize("set_" + (association.options.as || Sequelize.Utils.singularize(association.target.tableName, association.options.language)));

                    instance.generator[target.name] = targetInstance;

                    return instance[setterName].call(instance, targetInstance).then(function () {
                        return targetInstance;
                    });
                });
            }).then(function (targetInstances) {
                var guardedAsyncOperation = guard(guard.n(1), function (targetInstance) {
                    if (targetInstance && !_.isEmpty(targetInstance.daoFactory.associations)) {
                        return new G(targetInstance, options);
                    } else {
                        return targetInstance;
                    }
                });

                return when.map(targetInstances, guardedAsyncOperation);
            }).then(function () {
                return options.rootInstance;
            });
        }
    });
};
