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
            if (value === Sequelize.INTEGER) {
                attributes[key] = _.parseInt(_.uniqueId(), 10);
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
        var targets = _.pluck(instance.daoFactory.associations, "target");

        if (_.isEmpty(targets)) {
            return instance;
        } else {
            return when.all(targets.map(function (target) {
                var targetAttributes = options[target.name] && options[target.name].attributes || {};

                targetAttributes = setDefaultAttributesValue(target.rawAttributes, targetAttributes);

                return target.create(targetAttributes).then(function (targetInstance) {
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
