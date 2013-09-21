"use strict";

var _ = require("lodash"),
    Promise = require("promise");

module.exports = function G(sequelizeModelOrInstance, options) {
    options = options || {};

    function instanceIfNeeded() {
        // It is a model, create the instance
        if (sequelizeModelOrInstance.tableName) {
            return sequelizeModelOrInstance.create();
        } else {
            // It is already an instance, not a model, so wrap it as a promise
            return Promise.from(sequelizeModelOrInstance);
        }
    }

    return instanceIfNeeded(sequelizeModelOrInstance).then(function (instance) {
        // Since G is recursice, options.rootInstance keeps track of what should be ultimately returned
        if (!options.rootInstance) {
            options.rootInstance = instance;
        }
        var targets = _.pluck(instance.daoFactory.associations, "target");

        if (_.isEmpty(targets)) {
            return instance;
        } else {
            return new Promise.all(targets.map(function (target) {
                return target.create().then(function (targetInstance) {
                    return instance["set" + target.name](targetInstance).then(function () {
                        return targetInstance;
                    });
                });
            })).then(function (targetInstances) {
                return new Promise.all(targetInstances.map(function (targetInstance) {
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
