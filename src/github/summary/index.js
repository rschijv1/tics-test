import { generateLinkMarkdown,
    generateStatusMarkdown,
    generateTableMarkdown,
    generateStatusMarkdown2,
    generateExpandableAreaMarkdown } from './markdownGenerator.js';
import { getTiobewebBaseUrlFromGivenUrl } from '../../tics/ApiHelper.js';
import { ticsConfig } from '../configuration.js';

export const getErrorOrWarningSummary = (errorOrWarningList, status) => {

    let errorMessage = `## TICS Quality Gate\r\n\r\n### ${generateStatusMarkdown2(status, true)} \r\n\r\n #### The following have occurred during analysis:\r\n\r\n`;

   if (errorOrWarningList && Array.isArray(errorOrWarningList)) {
       errorOrWarningList.forEach(item => errorMessage += `> ${generateStatusMarkdown2(status, false)} ${item}\r\n`); 
    } else {
        errorMessage += `> ${generateStatusMarkdown2(status, false)} ${errorOrWarningList}\r\n`
    }

    return errorMessage;
}

export const getQualityGateSummary = (qualityGateObj) => {
    if (!qualityGateObj) {
       return "";
    }
    
    let gatesConditionsSummary = '';

    qualityGateObj.gates && qualityGateObj.gates.forEach(gate => {
        gatesConditionsSummary += `## ${gate.name} \n\n ${getQGCondtionsSummary(gate.conditions)}`;
    })
    
    return `## TICS Quality Gate \n\n ### ${generateStatusMarkdown(qualityGateObj.passed, true)} \n\n ${gatesConditionsSummary}\n`;
}

export const getLinkSummary = (link) => {
    return generateLinkMarkdown('See the results in the TICS Viewer', link) + `\n\n`;
}

export const getFilesSummary = (fileList) => {
    let changedFiles = "";
    fileList && fileList.map((item) => {
        changedFiles += item + ", "
    });

    return `#### The following file(s) have been checked:\n> ${changedFiles.slice(0, -1)}`;
}

/**
* Helper methods to generate markdown
*/
const getQGCondtionsSummary = (conditions) => {
    let out = '';
    
    conditions.forEach(condition => {
        if (condition.skipped !== true) {
            const gateConditionWithIcon = `${generateStatusMarkdown(condition.passed, false)}  ${condition.message}`; 

            if (condition.details !== null && condition.details.items.length > 0) {
                let headers = [];
                headers.push("File", condition.details.dataKeys.actualValue.title);
                let cells = getTableCellsDetails(condition.details.items.filter(item => item.itemType === "file"));

                out += generateExpandableAreaMarkdown(gateConditionWithIcon, generateTableMarkdown(headers, cells)) + '\n\n\n';
            } else {
                out += gateConditionWithIcon + ' \n\n\n';
            }
        }
    })
    
    return out;
}

const getTableCellsDetails = (items) => {
    return items.map((item) => {
        return {
                 name: item.name,
                 link: getTiobewebBaseUrlFromGivenUrl(ticsConfig.ticsConfiguration) + '/' + item.link,
                 score: item.data.actualValue.formattedValue
               };
    });
}
