"use strict";

var _ = require("lodash"),
    Promise = require("promise");

module.exports = function (sequelizeModel) {
    return sequelizeModel.create().then(function (instance) {
        var targets = _.pluck(instance.daoFactory.associations, "target");

        if (_.isEmpty(targets)) {
            return instance;
        } else {
            return Promise.all(targets.map(function (target) {
                return target.create().then(function (targetInstance) {
                    return instance["set" + target.name](targetInstance);
                });
            })).then(function () {
                return instance;
            });
        }
    });
};
