const _ = require('lodash');
const Sequelize = require('sequelize');
const guard = require('when/guard');
const when = require('when');

module.exports = function G(sequelizeModelOrInstance, defaultOptions) {
  const options = _.merge({
    attributes: {},
    number: 1,
  }, defaultOptions);

  function valueBasedOnAttribute(attribute) {
    let typeString;

    if (attribute.type) {
      typeString = attribute.type.toString();
    } else {
      typeString = attribute;
    }

    if (typeString === 'ENUM') {
      return _.sample(attribute.values);
    } if (_.includes(['INTEGER', 'SMALLINT UNSIGNED'], typeString)) {
      return _.parseInt(_.uniqueId(), 10);
      // starts with VARCHAR( or CHAR(, or is TEXT
    } if (typeString.indexOf('VARCHAR(') === 0 || typeString.indexOf('CHAR') === 0 || typeString === 'TEXT') {
      if (attribute.validate && attribute.validate.isUrl) {
        return `http://example.com/${_.uniqueId()}`;
      }
      return _.uniqueId();
    }

    return null;
  }

  function setDefaultAttributesValue(rawAttributes, customValues, associationIdentifiers) {
    const attributes = _.clone(customValues);

    _(rawAttributes)
    // Removes from rawAttributes any attributes from customValues.
    // We want user-passed values to take precedence
      .omit(_.keys(customValues))
    // Loop the remaining rawAttributes to set values according to its Sequelize data type
      .forEach((value, key) => {
        if (!_.has(value, 'autoIncrement') && value.autoIncrement !== true) {
          if (_.has(value, 'references') || _.includes(associationIdentifiers, key)) {
            attributes[key] = null;
          } else {
            const valueToPopulate = valueBasedOnAttribute(value);
            if (!_.isNull(valueToPopulate)) {
              attributes[key] = valueToPopulate;
            }
          }
        }
      }).value();

    return attributes;
  }

  function instancesIfNeeded(sequelizeModelOrInstanceToCreateInstances) {
    // It is a model, create the instance
    if (sequelizeModelOrInstanceToCreateInstances.tableName) {
      const associationIdentifiers = _.map(sequelizeModelOrInstanceToCreateInstances.associations, 'identifier');
      const bulkCreateArgument = [];

      for (let i = 0; i < options.number; i += 1) {
        const attributes = setDefaultAttributesValue(
          sequelizeModelOrInstanceToCreateInstances.rawAttributes,
          options.attributes,
          associationIdentifiers,
        );

        _.forEach(options.attributes, (value, key) => {
          if (_.isArray(value)) { // If value is an array, we consume the first element
            attributes[key] = value[i];
          } else if (_.isFunction(value)) { // If value is a function, execute it
            attributes[key] = value();
          }
        });

        bulkCreateArgument.push(attributes);
      }

      // Sadly .bulkCreate does not return the newly created instances. We need to .findAll, but
      // since calling G() multiple times could potentially run .findAll and return previously
      // created records, we need to .slice with just the last options.number elements
      return sequelizeModelOrInstanceToCreateInstances.bulkCreate(bulkCreateArgument)
        .then(() => sequelizeModelOrInstanceToCreateInstances.findAll())
        .then((instances) => instances.slice(-options.number));
    }
    // It is already an instance, not a model, so wrap it as a promise
    return when([sequelizeModelOrInstanceToCreateInstances]);
  }

  function firstOrCreate(instance, attributes) {
    return instance.findAll().then((instances) => {
      if (instances.length === 0) {
        return instance.create(attributes);
      }
      return _.first(instances);
    });
  }

  return instancesIfNeeded(sequelizeModelOrInstance).then((instances) => {
    const instance = instances[0];

    if (options.number > 1) {
      options.number -= instances.length;

      const guardedAsyncOperation = guard(guard.n(1), (instanceInner) => {
        // This part should be refactored with bulkCreateArgument.push's from instancesIfNeeded()
        const attributes = {};

        _.forEach(options.attributes, (value, key) => {
          if (_.isArray(value)) { // If value is an array, we consume the first element
            attributes[key] = value.shift();
          } else if (_.isFunction(value)) { // If value is a function, execute it
            attributes[key] = value();
          } else {
            attributes[key] = value;
          }
        });

        const optionsCopy = _.clone(options);
        optionsCopy.attributes = attributes;

        return new G(instanceInner, optionsCopy);
      });

      return when.map(instances, guardedAsyncOperation);
    }

    // Since G is recursive, options.rootInstance keeps track of what should be ultimately returned
    if (!options.rootInstance) {
      options.rootInstance = instance;
    }

    instance.generator = {};

    const associations = _.where(instance.Model.associations, {
      associationType: 'BelongsTo',
    });

    if (_.isEmpty(associations)) {
      return instance;
    }
    return when.map(associations, (association) => {
      const { target } = association;
      let targetAttributes = (options[target.name] && options[target.name].attributes) || {};
      let targetInstancePromise;

      const associationIdentifiers = _.map(target.associations, 'identifier');

      targetAttributes = setDefaultAttributesValue(
        target.rawAttributes,
        targetAttributes, associationIdentifiers,
      );

      if (options[target.name] && options[target.name] === 'shared') {
        targetInstancePromise = firstOrCreate(target, targetAttributes);
      } else if (options[target.name] === null) {
        return null;
      } else {
        // If the target identifier was passed as an atribute of instance, try to get the
        // existing record from the database. In other words, the foreign key value is set.
        // Otherwise, create the instance.
        targetInstancePromise = target.findOrCreate({
          id: options.attributes[association.identifier] || null,
        }, targetAttributes);
      }

      return targetInstancePromise.then((targetInstance) => {
        // setterName code copied straight from Sequelize
        // https://github.com/sequelize/sequelize/blob/0299ce638fc13ad79a50cd0714f274143babaf29/lib/associations/belongs-to.js#L71
        const setterName = Sequelize.Utils._.camelize(`set_${association.as || Sequelize.Utils.singularize(association.target.tableName, association.options.language)}`);

        instance.generator[target.name] = targetInstance;

        return instance[setterName].call(instance, targetInstance).then(() => targetInstance);
      });
    }).then((targetInstances) => {
      const guardedAsyncOperation = guard(guard.n(1), (targetInstance) => {
        if (targetInstance && !_.isEmpty(targetInstance.Model.associations)) {
          return new G(targetInstance, options);
        }
        return targetInstance;
      });

      return when.map(targetInstances, guardedAsyncOperation);
    }).then(() => options.rootInstance);
  });
};
