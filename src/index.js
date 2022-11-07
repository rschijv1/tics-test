import core from '@actions/core';
import { TicsAnalyzer } from './tics/TicsAnalyzer.js';
import { TicsPublisher } from './tics/TicsPublisher.js';
import { ticsConfig, githubConfig } from './github/configuration.js';
import { createIssueComment } from './github/issues/issues.js';
import { getPRChangedFiles, changeSetToFileList, createPRReview, getAllPRReviews } from './github/pulls/pulls.js';
import { getErrorOrWarningSummary, getQualityGateSummary, getLinkSummary, getFilesSummary } from './github/summary/index.js';
import { getTiobewebBaseUrlFromGivenUrl } from "./tics/ApiHelper.js";


if (githubConfig.eventName == 'pull_request') {
    run();
} else {
    core.setFailed("This action is running only on pull request events.");
}

export async function run() {
    try {

        core.info(`\u001b[35m > Retrieving changed files to analyse`);
        let changeSet = await getPRChangedFiles();
        let fileListPath = await changeSetToFileList(changeSet);

        core.info(`\u001b[35m > Analysing new pull request for project ${ticsConfig.projectName}.`);
        const ticsAnalyzer = new TicsAnalyzer();
        let {err, stdout, stderr} = await ticsAnalyzer.run(fileListPath);

        if (err && err.code != 0) {
            core.info(stdout);
            let errorList = stdout.match(/\[ERROR.*/g);
            
            if (errorList) {
                postSummary(errorList, true, "error");
            } else {
                postSummary(stderr, true, "error");
            }
            core.setFailed("There is a problem while running TICS Client Viewer. Please check that TICS is configured and all required parameters have been set in your workflow.");
            return;
        } else {
            core.info(stdout);
            let locateExplorerUrl = stdout.match(/http.*Explorer.*/g);
            let warningList = stdout.match(/\[WARNING.*/g);
            let explorerUrl = "";

            if (!!locateExplorerUrl) {
                explorerUrl = locateExplorerUrl.slice(-1).pop();
                core.info(`\u001b[35m > Explorer url retrieved ${explorerUrl}`);
            } else {
                postSummary(warningList, true, "skipped");
                return;
            }

            const ticsPublisher = new TicsPublisher();
            let qualitygates = await ticsPublisher.run(explorerUrl);

            let annotations = await Promise.all(qualitygates.annotationsApiV1Links && qualitygates.annotationsApiV1Links.map(async (link) => {
                 let fullLink = getTiobewebBaseUrlFromGivenUrl(ticsConfig.ticsConfiguration) + '/' + link.url;
                 return await ticsPublisher.getAnnotations(fullLink);
             }));


            let annotationsWithSummary = {};
            annotations && annotations.map((annotationObj) => {
                annotationsWithSummary = createAnnotationsSummary(annotationObj);
            });
            createPRReview(annotationsWithSummary);

            let results = {
                explorerUrl: explorerUrl,
                changeSet: changeSet,
                qualitygates: qualitygates
            };
            postSummary(results, false);
        }
    } catch (error) {
       core.error("Failed to run TiCS Github Action");
       core.error(error);
       core.setFailed(error.message);
    }
}

export function createAnnotationsSummary(annotationsObj) {
    let annotationsWithSummary = [];
    annotationsObj.data && annotationsObj.data.map((annotation) => {
        let annotation_temp = {
            body: `:warning: **${annotation.type} violation: ${annotation.msg}** \r\n Rule: ${annotation.rule}, Level: ${annotation.level}, Category: ${annotation.category} \r\n`,
            path: (annotation.fullPath).replace(`HIE://${ticsConfig.projectName}/${ticsConfig.branchName}/`, ""),
            line: annotation.line
        }
        annotationsWithSummary.push(annotation_temp);
    })

    return annotationsWithSummary;
}

export async function postSummary(summary, isErrorOrWarning, status) {
    let commentBody = {};

    if (isErrorOrWarning) {
        commentBody.body = getErrorOrWarningSummary(summary, status);
        createIssueComment(commentBody)
    } else {
        commentBody.body = getQualityGateSummary(summary.qualitygates) + getLinkSummary(summary.explorerUrl) + getFilesSummary(summary.changeSet);
        createIssueComment(commentBody);
    }
}