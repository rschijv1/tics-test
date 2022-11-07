import { Octokit } from "@octokit/action"; //GitHub API client for GitHub Actions
import { githubConfig } from '../configuration.js';
import core from '@actions/core';
import fs from 'fs';
import path from "node:path";

//Octokit client is authenticated
const octokit = new Octokit();
const payload = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const pullRequestNum = payload.pull_request ? payload.pull_request.number : "";

/* Helper functions to get all changed files params of a pull request */
const getPRChangedFilesParams = () => {
    let parameters = {
        accept: 'application/vnd.github.v3+json',
        owner: githubConfig.owner,
        repo: githubConfig.reponame,
        pull_number: pullRequestNum,
        per_page: 100,
        page: 1,
    }

    return parameters;
}

export const getPRChangedFiles =  async() => {
    let changedFiles= [];
    try {
       await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', getPRChangedFilesParams()).then((response) => {
            core.info(`Getting the changed files list ${response.data}`);
            response.data && response.data.map((item) => {
                changedFiles.push(item.filename);
            })
            return changedFiles; 
        })
    } catch(e) {
        core.error(`We cannot retrieve the changed files of this PR: ${e}`)
    }
    return changedFiles;
};

const getPRReviewParams = (inputParams) => {
    let params = {
        owner: githubConfig.owner,
        repo: githubConfig.reponame,
        pull_number: pullRequestNum,
        event: "COMMENT",
        body: "Summary goes here",
        comments: inputParams
    }
    return params;
}

export const createPRReview =  async(inputParams) => {
    try {
       await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', getPRReviewParams(inputParams)).then((response) => {
           core.info(`Created a PR review with the latest annotations found.`)
           core.info(response.data);
       });
    } catch(e) {
        core.error(`We cannot post the annotations of this PR: ${e}`)
    }
};

export const updatePRReview =  async(inputParams) => {
    let parameters = {
        accept: 'application/vnd.github.v3+json',
        owner: githubConfig.owner,
        repo: githubConfig.reponame,
        pull_number: pullRequestNum,
        review_id: inputParams.reviewId
    }
    try {
       await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', getPRReviewParams(inputParams)).then((response) => {
           core.info(`Created a PR review with the latest annotations found.`)
           core.info(response.data);
       });
    } catch(e) {
        core.error(`We cannot post the annotations of this PR: ${e}`)
    }
};

export const getAllPRReviews = async() => {
    let parameters = {
        accept: 'application/vnd.github.v3+json',
        owner: githubConfig.owner,
        repo: githubConfig.reponame,
        pull_number: pullRequestNum
    }

    let allReviews = [];

     try {
       allReviews = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', parameters).then((response) => {
           core.info(`Getting all the pr reviews so far.`)
           return response.data;
       });
    } catch(e) {
        core.error(`We cannot get the annotations of this PR: ${e}`)
    }

    return allReviews;
}

export function changeSetToFileList(changeSet) {
    core.info(`\u001b[35m > Creation of file list based on PR changeSet`);
    let contents = "";
    
    changeSet && changeSet.map((item) => {
        contents += item + "\n";
    })

    var stream = fs.createWriteStream('changeSet.txt', { mode: 0o777 });
    stream.write(contents);
    stream.end();

    return path.resolve('changeSet.txt');
}
