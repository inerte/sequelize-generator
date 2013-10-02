"use strict";

var _ = require("lodash"),
    Sequelize = require("sequelize"),
    when = require("when");

module.exports = function G(sequelizeModelOrInstance, options) {
    options = options || {
        attributes: {}
    };

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
                } else if (value === Sequelize.INTEGER || value.type === Sequelize.INTEGER) {
                    attributes[key] = _.parseInt(_.uniqueId(), 10);
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

        var associations = instance.daoFactory.associations;

        if (_.isEmpty(associations)) {
            return instance;
        } else {
            return when.all(_.map(associations, function (value) {
                var target = value.target,
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
                        id: options.attributes[value.identifier] || null
                    }, targetAttributes);
                }

                return targetInstancePromise.then(function (targetInstance) {
                    return instance["set" + target.name](targetInstance).then(function () {
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
