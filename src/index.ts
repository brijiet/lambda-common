import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda';
import axios, { Axios } from 'axios';
import 'dotenv/config';
import { sendEmail } from './utils/sendEmail';
const APIUrl: string = process.env.NODE_BACKEND_SERVER as string;
import * as handlebars from 'handlebars';
import * as path from 'path';
import * as fs from 'fs/promises';
import { formatDistanceToNow } from 'date-fns';
import { v4 as uuidV4 } from 'uuid';

let emailVerifyTemplate: HandlebarsTemplateDelegate<any> | undefined;
let recommendedCandidatesTemplate: HandlebarsTemplateDelegate<any> | undefined
let newApplicantTemplate: HandlebarsTemplateDelegate<any> | undefined

export const readAndCompileTemplate = async (fileName: string) => {
  try {

    const __dirname = path.resolve();
    const hbsPath = path.join(__dirname, 'src', 'templates', fileName)
    const content = await fs.readFile(hbsPath, 'utf-8');
    return handlebars.compile(content);

  } catch (error) {
    console.log('error in readAndCompileTemplate ', error);
  }
}

// event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>
export const handler = async (): Promise<void> => {

  try {
    let cursor: number = 0;
    console.log('in the lambda function ');
    emailVerifyTemplate = await readAndCompileTemplate('emailTemplate.hbs');
    recommendedCandidatesTemplate = await readAndCompileTemplate('recommendedCandidatesAlert.hbs');
    newApplicantTemplate = await readAndCompileTemplate('newApplicantReceived.hbs');
    while (true) {

      const response = await axios.get(`${APIUrl}/serverless/emailStaging/${cursor}`);
      const emailVerifyData = response.data;
      // console.log('response ', JSON.stringify(emailVerifyData));
      if (emailVerifyData?.data?.length === 0) {
        break;
      };
      await processFetchedTemplateData(emailVerifyData.data)
      cursor = emailVerifyData?.data[emailVerifyData?.data?.length - 1]?.id

    }
    // const response: APIGatewayProxyResult = {
    //   statusCode: 200,
    //   isBase64Encoded: false,
    //   body: JSON.stringify({
    //     message: 'Email successfully sent'
    //   })
    // };
    // return response;

  } catch (error) {
    console.log('error ', error);
    // const errorResponse: APIGatewayProxyResult = {
    //   statusCode: 500,
    //   isBase64Encoded: false,
    //   body: JSON.stringify({
    //     message: 'Email delivery failed'
    //   })
    // };
    // return errorResponse;
  };

}

export const processFetchedTemplateData = async (data: any[]): Promise<void> => {
  try {

    const APIUrl: string = process.env.NODE_BACKEND_SERVER as string;
    for (const [index, emailStaging] of data?.entries()) {
      const postData = {
        email: emailStaging.emailTo
      }
      console.log('email data  ', postData)
      const tokenResponse = await axios.post(`${APIUrl}/serverless/generateToken`, postData);

      const token = tokenResponse.data.token
      if (token) {

        switch (emailStaging.template.title) {
          case 'emailVerify':
            await processEmailVerifyTemplates(emailStaging, token);
            break;
          case 'RecommendedCandidates':
            console.log('recommend start ')
            // await recommendedCandidatesTemplates(emailStaging, token);
            // console.log('recommend end ')
            break;
          case 'ApplyJob':
            await processApplyJobTemplates(emailStaging, token)
            break;
          default:
            break;
        }
      }


    }
    return;
  } catch (error) {
    console.log('error in the process of emailTemplates', error);

  }
}


export const processEmailVerifyTemplates = async (emailStaging: any, token: string) => {
  try {

    const link = `${APIUrl}/jobSeekerProfile/emailVerify/${token}`

    const userParams = {
      email: emailStaging.emailTo,
      emailVerifyLink: link
    }

    const response = await axios.put(`${APIUrl}/serverless/updateUser`, userParams);
    console.log('email staging in email verify ', JSON.stringify(emailStaging));
    console.log('response of update ', response.status)
    if (response.status === 200) {
      const data = {
        title: 'My Page',
        heading: 'Welcome to my website',
        content: 'This is some content for the page.',
        link: link,
        name: emailStaging?.objectName?.user?.name
      };
      if (emailVerifyTemplate) {
        const htmlContent = emailVerifyTemplate(data)
        // console.log('html email ', htmlContent)
        const msg = {
          // from: process.env.SENDGRID_SENDER_EMAIL as string,
          from: process.env.NODEMAILER_USER as string,
          to: emailStaging.emailTo as string,
          html: htmlContent,
          text: 'Test email',
          subject: 'Email Verification'
        };
        // sendEmail(msg, true, emailStaging?.id);
        console.log('email  after send')
      }

    }


  } catch (error) {
    console.log('error in the processEmailVerifyTemplates ', error);
  }
}

export const recommendedCandidatesTemplates = async (stagingTemplate: any, token: string) => {
  try {

    const job = stagingTemplate?.objectName?.jobs;
    // console.log('jobs data ', JSON.stringify(job));
    const jobLocations = job?.jobsLocation?.map((jobLocation: any) => {
      return jobLocation?.location?.title
    });
    const jobKeySkillsIds = job?.jobsKeySkills?.map((jobsKeySkill: any) => {
      return jobsKeySkill?.keySkills?.id
    });
    const jobKeySkillsTitles = job?.jobsKeySkills?.map((jobsKeySkill: any) => {
      return jobsKeySkill?.keySkills?.title
    });
    const jobOject = {
      portalLink: process.env.REACT_SERVER,
      id: job?.id,
      title: job?.title,
      payScale: `${job?.payScaleLowerRange?.title[0]} - ${job?.payScaleUpperRange?.title} ${job?.numberSystem?.title}`,
      location: jobLocations?.join(', '),
      keySkills: jobKeySkillsTitles?.join(', '),
      experience: `${job?.totalExpYearStart?.title}-${job?.totalExpYearEnd?.title} Yrs`,
      userName: job?.user?.name,
      userEmail: job?.user?.email,
      userId: job?.user?.id,
      jobKeySkillsCount: jobKeySkillsTitles?.length,
      jobKeySkillsArray: jobKeySkillsTitles
    };

    const response = await axios.post(`${APIUrl}/serverless/emailStaging/jobSeeker`, { jobKeySkills: jobKeySkillsIds });
    const jobSeekerProfiles = response.data?.data;
    if (jobSeekerProfiles && jobSeekerProfiles?.length > 0) {
      await processJobSeekerProfiles(jobSeekerProfiles, jobOject, token, stagingTemplate?.id);
    }

  } catch (error) {
    console.log('error in recommendedCandidatesTemplates :', error);

  }

}

export const processJobSeekerProfiles = async (jobSeekerProfiles: any, jobOject: any, token: string, id = undefined) => {
  try {
    // console.log('job seeker ', JSON.stringify(jobSeekerProfiles));
    const response = await axios.get(`${APIUrl}/applyJob/countApplicant/${jobOject?.id}`);
    const applicantCount = response.data?.data;
    jobOject.applicantCount = applicantCount?.count;
    const jobSeekersList = await jobSeekerProfiles?.map((jobSeekerData: any) => {
      const education = jobSeekerData?.educations?.filter((jobSeekerEducation: any) => (jobSeekerEducation?.specialization));
      const jobSeekerSkillsArray = (jobSeekerData?.keySkills?.map((keySkill: any) => keySkill?.profileKeySkills?.title));
      const jobSeekerSkills = jobSeekerSkillsArray.join(', ');
      const jobApplicantListLink = `${APIUrl}/serverless/jobApplicantsList/${token}/${jobOject?.id}`;
      jobOject.jobApplicantListLink = jobApplicantListLink;
      // console.log('keyskills  ', jobSeekerData?.keySkills,jobSeekerSkills )
      const preferredLocations = (jobSeekerData?.careerProfile?.careerProfilePreferredLocations?.map((careerLocation: any) => careerLocation?.location?.title))?.join(', ');
      const currentLocation = jobSeekerData?.currentLocation?.title;
      const jobSeekerLocations = `${currentLocation}(Preferred Location is  ${preferredLocations})`
      // console.log('jobSeekerLocations ', jobSeekerData?.careerProfile?.careerProfilePreferredLocations, jobSeekerLocations);

      //calculate skills matched percentage;
      let skillsMatchedCount = 0;
      for (const keySkill of jobSeekerSkillsArray) {
        if (jobOject?.jobKeySkillsArray?.includes(keySkill)) {
          skillsMatchedCount++
        }
      };

      let skillsMatchedPercent = 0;
      if (jobOject?.jobKeySkillsArray?.length !== 0) {
        skillsMatchedPercent = Math.floor((skillsMatchedCount / jobOject?.jobKeySkillsArray?.length) * 100);
      };
      console.log('skills count ', 'matched count ', skillsMatchedCount, skillsMatchedPercent, jobOject?.jobKeySkillsArray?.length);
      const jobSeekerLink = `${APIUrl}/jobSeekerProfile/recommendedCandidatesAlert/${token}/${jobSeekerData?.id}`;
      const jobSeekerObject = {
        id: jobSeekerData?.id,
        experience: `${jobSeekerData?.totalExpYear?.title} & ${jobSeekerData?.totalExpMonth?.title} `,
        jobDetails: `${jobSeekerData?.currentJobTitle?.title} at ${jobSeekerData?.currentCompany?.title}`,
        currentSalary: `${jobSeekerData?.currentSalary} LPA`,
        education: `${education[0]?.specialization} at ${education[0]?.institute}`,
        jobSeekerLink: jobSeekerLink,
        jobSeekerName: jobSeekerData?.user.name,
        jobSeekerSkills: jobSeekerSkills,
        jobSeekerLocations: jobSeekerLocations,
        jobSeekerSkillsMatched: `${skillsMatchedPercent}%`,
        jobSeekerNoticePeriod: jobSeekerData?.noticePeriod?.title
      };
      return jobSeekerObject;
    });
    const data = {
      job: jobOject,
      jobSeekers: jobSeekersList,
      allLink: `${APIUrl}/jobSeekerProfile/allRecommendedCandidatesAlert/${token}`
    };
    console.log('data2   ', data);
    if (recommendedCandidatesTemplate) {
      const htmlContent = recommendedCandidatesTemplate(data);
      // console.log('recommended after ', data);
      // console.log('recommended ',data)
      const msg = {
        from: process.env.SENDGRID_SENDER_EMAIL as string,
        to: jobOject?.userEmail as string,
        html: htmlContent,
        subject: 'Recommended Candidates alert'
      };

      const mailgunMessage = {
        // to: jobOject?.userEmail,
        to: 'psraws1@gmail.com',
        // from: process.env.SENDGRID_SENDER_EMAIL as string,
        from: 'Jobportal  <psrtest56@gmail.com>',
        subject: 'Recommended candidates alert',
        html: htmlContent
      }
      // sendEmail(mailgunMessage,true,id);
    };

    return
  } catch (error) {
    console.log('error in processJobSeekerProfiles  ', error)
  }
}

export const processApplyJobTemplates = async (stagingTemplate: any, token: string) => {
  try {
    // console.log('apply start ', stagingTemplate?.objectName?.jobs?.title)
    const job = stagingTemplate?.objectName?.jobs;

    console.log('job details ', job?.id, `${APIUrl}/applyJob/countApplicant/${job?.id}`);
    const jobSeeker = stagingTemplate?.objectName?.applyJob?.jobSeekerProfile;
    // console.log('jobseeker obj in apply ', JSON.stringify(jobSeeker));
    const response = await axios.get(`${APIUrl}/applyJob/countApplicant/${job?.id}`);
    const applicantCount = response.data?.data;
    console.log('applicant count ', applicantCount);
    const postedDistance = formatDistanceToNow(job?.createdAt, { addSuffix: true });
    const jobApplicantListLink = `${APIUrl}/serverless/jobApplicantsList/${token}/${job?.id}`
    const jobOject = {
      jobId: job?.id,
      jobTitle: job?.title,
      jobPostedDistance: postedDistance,
      jobApplicantsCount: applicantCount?.count,
      userEmail: job?.user?.email,
      userName: job?.user?.name,
      allApplicantsList: jobApplicantListLink,

    };
    const jobKeySkillsTitles = job?.jobsKeySkills?.map((jobsKeySkill: any) => {
      return jobsKeySkill?.keySkills?.title
    });

    const jobKeySkillsCount = jobKeySkillsTitles?.length;
    // console.log('job object ', jobOject);
    const education = jobSeeker?.educations?.filter((data: any) => (data?.specialization));
    const keySkillsArray = (jobSeeker?.keySkills?.map((keySkill: any) => keySkill?.profileKeySkills?.title))
    const preferredLocations = (jobSeeker?.careerProfile?.careerProfilePreferredLocations?.map((careerLocation: any) => careerLocation?.location?.title))?.join(', ');
    const jobSeekerObject = {
      jobSeekerName: jobSeeker?.user?.name,
      jobSeekerId: jobSeeker?.user?.id,
      jobSeekerTitle: `${jobSeeker?.currentJobTitle?.title} at ${jobSeeker?.currentCompany?.title}`,
      jobSeekerNoticePeriod: jobSeeker?.noticePeriod?.title,
      jobSeekerKeySkills: keySkillsArray?.join(', '),
      jobSeekerEducation: `${education[0]?.specialization} at ${education[0]?.institute}`,
      jobSeekerLocations: `${jobSeeker?.currentLocation?.title}(${preferredLocations})`,
      jobSeekerExperience: `${jobSeeker?.totalExpYear?.title} & ${jobSeeker?.totalExpMonth?.title}`
    };

    let skillsMatchedCount = 0;

    for (const keySkill of keySkillsArray) {
      if (jobKeySkillsTitles?.includes(keySkill)) {
        skillsMatchedCount++
      }
    }

    let skillsMatchedPercent = 0;

    if (jobKeySkillsTitles?.length > 0) {
      skillsMatchedPercent = Math.floor((skillsMatchedCount / jobKeySkillsTitles?.length) * 100)
    }
    const applicantViewLink = `${APIUrl}/serverless/viewApplicant/${token}/${jobSeeker?.user?.id}`;
    const resumeLink = `${APIUrl}/serverless/downloadResume/${token}/${jobSeeker?.resumePath}/${jobSeeker?.resumeFile}`;
    const connectLink = `${APIUrl}/serverless/contact/${token}/${jobSeeker?.user?.id}`
    const data = {
      jobPOrtal: process.env.REACT_SERVER,
      jobId: job?.id,
      jobTitle: job?.title,
      jobPostedDistance: postedDistance,
      jobApplicantsCount: applicantCount?.count,
      userEmail: job?.user?.email,
      userName: job?.user?.name,
      allApplicantsList: jobApplicantListLink,
      jobSeekerName: jobSeeker?.user?.name,
      jobSeekerId: jobSeeker?.user?.id,
      jobSeekerTitle: `${jobSeeker?.currentJobTitle?.title} at ${jobSeeker?.currentCompany?.title}`,
      jobSeekerNoticePeriod: jobSeeker?.noticePeriod?.title,
      jobSeekerKeySkills: keySkillsArray?.join(', '),
      jobSeekerEducation: `${education[0]?.specialization} at ${education[0]?.institute}`,
      jobSeekerLocations: `${jobSeeker?.currentLocation?.title}(${preferredLocations})`,
      jobSeekerExperience: `${jobSeeker?.totalExpYear?.title} & ${jobSeeker?.totalExpMonth?.title}`,
      applicantViewLink: applicantViewLink,
      resumeLink: resumeLink,
      jobLink: `${APIUrl}/jobSeekerProfile/recommendedJobAlert/${token}/${job.id}`,
      connectLink: connectLink,
      skillsMatchedPercent: `${skillsMatchedPercent}%`,
      jobSeekerCurrentSalary: `${jobSeeker?.currentSalary} LPA`
    };

    if (newApplicantTemplate) {
      console.log('new applicant ', data);
      const htmlContent = newApplicantTemplate(data);
      // const msg = {
      //   from: process.env.SENDGRID_SENDER_EMAIL as string,
      //   to: job?.user?.email as string,
      //   html: htmlContent,
      //   subject: 'New Applicant received'
      // };

      const communicationsData = {
        id: uuidV4(),
        recruiterUser: job?.user?.id,
        jobSeekerUser: stagingTemplate?.senderUserId,
        jobsCommunication: 3,
        messages: [{
          messageBody: htmlContent,
          receiverId: job?.user?.id,
          senderId: stagingTemplate?.senderUserId,
          messageType: 'Email',
          showStatus: 1,
          emailStaging: stagingTemplate?.id
        }]
      }
      console.log('url ', `${APIUrl}/serverless/saveCommunications/${token}`, JSON.stringify(communicationsData))

      const saveCommunications = await axios.post(`${APIUrl}/serverless/saveCommunications/${token}`, communicationsData);
      const mailgunMessage = {
        // to: jobOject?.userEmail,
        to: 'psraws1@gmail.com',
        // from: process.env.SENDGRID_SENDER_EMAIL as string,
        from: 'psrtest56@gmail.com',
        subject: 'New Applicant received',
        html: htmlContent
      }
      // sendEmail(mailgunMessage);

    };

    // console.log('jobSeeker object ', jobSeekerObject);
  } catch (error) {
    console.log('error in processApplyJobTemplates ', error);
    throw error;
  }
}
handler();