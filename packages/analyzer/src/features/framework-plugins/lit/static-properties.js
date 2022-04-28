import { createAttributeFromField } from '../../analyse-phase/creators/createAttribute.js';
import { getDefaultValuesFromConstructorVisitor } from '../../analyse-phase/creators/createClass.js';
import { handleJsDoc } from '../../analyse-phase/creators/handlers.js';
import { isAlsoAttribute, hasStaticKeyword, getPropertiesObject, getAttributeName, reflects } from './utils.js';

import { extractMixinNodes, isMixin } from '../../../utils/mixins.js';
import { handleName } from '../../analyse-phase/creators/createMixin.js';

/**
 * STATIC-PROPERTIES
 * 
 * Handles `static get properties()` and `static properties`
 */
export function staticPropertiesPlugin() {
  return {
    name: 'CORE - LIT-STATIC-PROPERTIES',
    analyzePhase({ts, node, moduleDoc, context}){
      switch (node.kind) {
        case ts.SyntaxKind.VariableStatement:
        case ts.SyntaxKind.FunctionDeclaration:
          if(isMixin(node)) {
            const { mixinFunction, mixinClass } = extractMixinNodes(node);
            const { name } = handleName({}, mixinFunction);
            handleStaticProperties(mixinClass, moduleDoc, context, name);
          }
          break;

        case ts.SyntaxKind.ClassDeclaration:
          handleStaticProperties(node, moduleDoc, context);
          break;
      }
      // if (node.members) {
      //   console.log('---------- members --------');
      //   console.log(node.members.map(member => member && member.name ? member.name.escapedText : member.body.statements[0].expression.expression));
      // }
    }
  }
}

function handleStaticProperties(classNode, moduleDoc, context, mixinName = null) {
  let className;
  if(!mixinName) {
    className = classNode?.name?.getText();
  } else {
    className = mixinName;
  }
  const currClass = moduleDoc?.declarations?.find(declaration => declaration.name === className);  

  console.log({ className, mixinName, currClass });

  classNode?.members?.forEach(member => {
    if (hasStaticKeyword(member) && member.name.text === 'properties') {
      const propertiesObject = getPropertiesObject(member);

      propertiesObject?.properties?.forEach(property => {
        let classMember = {
          kind: 'field',
          name: property?.name?.getText() || '',
          privacy: 'public',
        };

        

        classMember = handleJsDoc(classMember, property);

        if (isAlsoAttribute(property)) {
          const attribute = createAttributeFromField(classMember);

          /**
           * If an attribute name is provided
           * @example @property({attribute:'my-foo'})
           */
          const attributeName = getAttributeName(property);
          if(attributeName) {
            attribute.name = attributeName;
            classMember.attribute = attributeName;
          } else {
            classMember.attribute = classMember.name;
          }

          if(reflects(property)) {
            classMember.attribute = attribute.name;
            classMember.reflects = true;
          }

          const existingAttr = currClass?.attributes?.find(attr => attr.name === attribute.name);
          if(!existingAttr) {
            currClass.attributes.push(attribute);
          } else {
            currClass.attributes = currClass?.attributes?.map(attr => attr.name === attribute.name ? ({...attr, ...attribute}) : attr);
          }
        }

        const existingIndex = currClass?.members?.findIndex(field => field.name === classMember.name);

        // console.log('existingField', currClass.members, existingIndex);
        if(!existingIndex) {
          currClass.members.push(classMember);
        } else {
          // console.log('existingField', currClass.members[existingIndex]);
          // console.log({ classMember });

          // currClass.members = currClass?.members?.map(field => field.name === classMember.name ? ({...field, ...classMember}) : field);

        }
      });
      return;
    }
  });

  // console.log('currClass', currClass.members);

  /** Get default values */
  getDefaultValuesFromConstructorVisitor(classNode, currClass, context);  
}
