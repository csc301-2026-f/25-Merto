# YOUR PRODUCT/TEAM NAME

> _Note:_ This document will evolve throughout your project. You commit regularly to this file while working on the project (especially edits/additions/deletions to the _Highlights_ section).
> **This document will serve as a master plan between your team, your partner and your TA.**

## Product Details

#### Q1: What is the product?

> Short (1 - 2 min' read)

- Start with a single sentence, high-level description of the product.
- Be clear - Describe the problem you are solving in simple terms.
- Specify if you have a partner, who they are (role/title), and the organization information.
- Be concrete. For example:
  - What are you planning to build? Is it a website, mobile app, browser extension, command-line app, etc.?
  - When describing the problem/need, give concrete examples of common use cases.
  - Assume the reader knows nothing about the partner or the problem domain and provide the necessary context.
- Focus on _what_ your product does, and avoid discussing _how_ you're going to implement it.  
  For example: This is not the time or the place to talk about which programming language and/or framework you are planning to use.
- **Feel free (and very much encouraged) to include useful diagrams, mock-ups and/or links**.

#### Q2: Who are your target users?

> Short (1 - 2 min' read max)

- Be specific (e.g. a 'a third-year university student taking CSC301 and studying Computer Science' and not 'a student')
- **Feel free to use personas. You can create your personas as part of this Markdown file, or add a link to an external site (for example, [Xtensio](https://xtensio.com/user-persona/)).**

#### Q3: Why would your users choose your product? What are they using today to solve their problem/need?
#### Problem raised by Merto's AI
Dealership managers currently rely on manual spot-checks, basic CRM reports, and largely unmonitored AI agents to oversee customer interactions. These approaches are time-consuming, provide limited visibility into AI performance, and may introduce errors or missed follow-ups to go undetected.

#### Benefits of our applications
#### 1. Manager-Facing Analytics Dashboard

Provides managers with clear, actionable performance metrics such as response time, escalation rate, appointment bookings, and conversion barriers. The dashboard gives managers greater visibility into AI agent performance and customer interactions, helping them identify trends and potential issues.
#### 2. Automated Conversation Evaluation Pipeline

Replaces time-consuming manual transcript reviews with an automated scoring system that evaluates conversations and flags risky or low-quality interactions for human review. This allows managers to focus on conversations that require intervention, as well as helping identify and correct AI mistakes before they harm customer relationships.
#### 3. Automatic Follow-Up System

Automatically re-engage unconverted or inactive leads according to structured follow-up cadences. This reduces manual workload while ensuring that leads receive consistent and timely follow-up instead of being overlooked.
#### Alignment with Merto's AI mandate
These systems work together to support Merto.ai's goal of delivering reliable, production-grade AI for automotive dealerships by combining automation, quality control, and executive visibility.
#### Q4: What are the user stories that make up the Minumum Viable Product (MVP)?
We will be implementing three main features, in the following priority:

1. AI CRM Dashboard


2. Conversation Evaluation
3. Follow-up System

Prototype link: https://www.figma.com/make/h6Sdmrc6AsJxeOVEOwmGn5/Manager-Analytics-Dashboard--Copy-?fullscreen=1&t=GLdQLfJDAHl8pu7w-1&code-node-id=0-6
## CRM/Dashboard
### US1: View Buyer and Deal History

#### User Story

As a dealership manager, I want to view a dashboard of buyers and their deal history in order to understand the current status of each buyer.

#### Acceptance Criteria

- The dashboard displays a list of buyers.

- Each buyer has a corresponding deal/conversation history.

- The history includes relevant information such as appointments, trade-ins, promises, and follow-up status when available.

- The manager can select a buyer to view their details.

### US2: Shared Buyer Record
As a dealership employee, I want to view a shared buyer record in order to understand what has happened with a buyer without having to ask other employees.

#### Acceptance Criteria

- The buyer record is accessible to authorized employees.
- The record displays relevant interactions and recorded information in chronological order.

- Information recorded by different employees is visible within the same buyer record.

- The system distinguishes unresolved or pending items when applicable.
### US3: Review AI Activity

#### User Story

As a dealership manager, I want to review AI agent activity for a buyer in order to monitor what the AI has communicated to customers.

#### Acceptance Criteria

- The manager can access AI-generated conversations from a buyer's record.

- Conversations show the relevant messages/interactions in chronological order.

- The manager can distinguish AI activity from human activity.

- The manager can identify conversations that require human attention.


### US4: View Unresolved Work

#### User Story

As a dealership manager, I want to see unresolved work associated with buyers in order to ensure that important customer actions are not overlooked.

#### Acceptance Criteria

- Buyer records identify unresolved or pending actions when detectable.

- The manager can view unresolved items from the dashboard or buyer record.

- Each item provides enough context for the manager to understand what needs attention.

- Completed or resolved items are distinguishable from unresolved items.

## Conversation Evaluation


### US5: Evaluate AI Conversations

#### User Story

As a dealership manager, I want AI conversations to be automatically evaluated in order to identify responses that may require human review.

#### Acceptance Criteria

- The system evaluates completed AI conversations.

- Each evaluated conversation receives an evaluation result based on defined criteria.

- Potentially problematic AI responses are flagged.
The manager can view the reason or criteria associated with a flag.

- Unflagged conversations remain accessible for review.

## Follow-Up System
### US6: Identify Buyers Requiring Follow-Up

#### User Story

As a dealership sales representative, I want the system to identify buyers who have not received a required follow-up in order to prevent potential sales opportunities from going cold.

#### Acceptance Criteria

- The system identifies buyers who meet the defined criteria for follow-up.

- Follow-up status is visible to the sales representative.

- Buyers who have already received the required follow-up are not incorrectly marked as needing follow-up.

- The system records when a follow-up occurs.


### US7: Schedule Follow-Up

#### User Story

As a dealership sales representative, I want to send or schedule follow-ups for buyers in order to maintain communication and move potential sales forward.

#### Acceptance Criteria

- The representative can initiate or schedule a follow-up for an eligible buyer.

- The follow-up timing is recorded.
The follow-up status is updated after the action occurs.

- The buyer's history reflects the follow-up.
#### Q5: Have you decided on how you will build it? Share what you know now or tell us the options you are considering.
#### Technology Stack

Our project will be developed as a standalone application that Merto can integrate into their existing proudct later. Currently we are considering:

- Frontend: Next.js, React, TypeScript
- Backend: TypeScript/Node.js with REST API
- Database: PostgresSQL, potentially through Supabase
- Conversation Evaluation: Python may be used for ML/conversation scoring
- Development Tools: Git, GitHub for collaboration

#### Deployment

We are considering a cloud-based deployment using services compatible with our chosen stack, such as Vercel for Next.js frontend and Supabasefor PostgreSQL database and backend services.

The final deployment approach will be determined after we finalize the prototype and architecture with Merto.

#### High-Level Architecture

![Architecture Diagram](architecture_diagram.png)

#### Third-Party Applications and APIs

Merto will provide access to its existing data through a scoped API. Therefore, we will work with Merto's existing data and infrastructure rather than requiring access to third-party applications/APIs.

## Intellectual Property Confidentiality Agreement

> Note this section is **not marked** but must be completed briefly if you have a partner. If you have any questions, please ask on Piazza.
>
> **By default, you own any work that you do as part of your coursework.** However, some partners may want you to keep the project confidential after the course is complete. As part of your first deliverable, you should discuss and agree upon an option with your partner. Examples include:

1. You can share the software and the code freely with anyone with or without a license, regardless of domain, for any use.
2. You can upload the code to GitHub or other similar publicly available domains.
3. You will only share the code under an open-source license with the partner but agree to not distribute it in any way to any other entity or individual.
4. You will share the code under an open-source license and distribute it as you wish but only the partner can access the system deployed during the course.
5. You will only reference the work you did in your resume, interviews, etc. You agree to not share the code or software in any capacity with anyone unless your partner has agreed to it.

**Your partner cannot ask you to sign any legal agreements or documents pertaining to non-disclosure, confidentiality, IP ownership, etc.**

Briefly describe which option you have agreed to.

---

## Teamwork Details

#### Q6: Have you met with your team?

##### Team-building activity

We met online over Zoom on September 29 to discuss our first deliverable and get to know each other better. As a team-building activity, we played Scattergories, which gave us a chance to relax and learn more about each other outside of the project.

##### Evidence

![Team Zoom meeting on September 29](team-meeting.png)

##### Fun facts

- Luis has three cats that are 2, 3, and 10 years old.
- Ethan only wears gray socks.
- Michael is an executive in the UofT Anime Club.
- Luis and Jason are both left-handed.

#### Q7: What are the roles & responsibilities on the team?

Jason and Ethan are doing database work, including database design, data models, and connecting the database with the backend. They were chosen because they both took CSC343.

Bobby, Vic, and Rachel are doing backend work, including APIs, application logic, and connecting the backend with the frontend and database. They were chosen because they have relevant backend experience.

Luis and Michael are doing frontend work, including building the user interface and connecting it to the backend. They are also using this opportunity to learn something new.

Luis will also be the partner liaison and handle communication, questions, and updates with the project partner.

Everyone will still contribute to the code and help with testing, documentation, and other project tasks when needed.

#### Q8: How will you work as a team?

We will have a weekly team meeting every Saturday from 11 AM–12 PM on Zoom. The purpose of this meeting is to check in on everyone’s progress, discuss any issues, and plan tasks for the upcoming week.

We will also have a weekly meeting with our project partner every Sunday at 7 PM on Google Meet. These meetings will be used to provide progress updates, ask questions, get feedback, and discuss next steps for the project.

#### Q9: How will you organize your team?

We will mainly use Discord to organize our team and keep track of work. We will have different channels for general discussion, questions, sharing resources, task assignments, and project updates. Our TA and project partner will be given access to the relevant channels.

Tasks will be assigned and tracked through Discord based on each person's role and current workload. We will prioritize tasks based on deadlines, importance, and whether other work depends on them. Team members will post updates as tasks move from to-do, to in progress, to completed.

We will also use GitHub for our code and may use GitHub Issues for tracking specific technical tasks or bugs.

#### Q10: What are the rules regarding how your team works?

**Communications:**

- What is the expected frequency? What methods/channels will be used?
- If you have a partner project, what is your process for communicating with your partner? Who is responsible?

**Collaboration:**

- How are people held accountable for attending meetings, completing action items? What is your process?
- How will you address the issue if one person doesn't contribute or is not responsive?

## Organisation Details

#### Q11. How does your team fit within the overall team organisation of the partner?

- Given the team structure of your partner, what role do you think your team will play?
- Examples include product development that includes developing new features, or quality assurance that includes developing features that test the product reliability, or software maintenance that includes fixing crucial bugs in the product.
- Provide examples of why you think you fit this role.

#### Q12. How does your project fit within the overall product from the partner?

- Look at the big picture of the product and think about how your project fits into this product.
- Is your project the first step towards building this product? Is it the first prototype? Are you developing the frontend of a product whose backend is developed by the partner? Are you building the release pipelines for a product that is developed by the partner? Are you building a core feature set and take full ownership of these features?
- You should also provide details of who else is contributing to what parts of the product, if you have this information. This is more important if the project that you will be working on has strong coupling with parts that will be contributed to by members other than your team (e.g., from a partner).
- You can be creative for these questions and even use a graphical or pictorial representation to demonstrate the fit.
- Briefly specify what your partner considers a success for this project. Do they want you to build specific features? Publish a usable product? Just a prototype? Be as specific as you can be at this point.

## Potential Risks

#### Q13. What are some potential risks to your project?

- Now that you have defined your project, what risks can you identify that might impact it?
- Some examples of risks at this planning stage could include:
  - Uncertainties regarding a specific feature
  - Misaligned expectations or conflicts
  - Lack of clarity in execution or decision-making
  - Limited access to data, systems, or other dependencies
  - User stories that are too abstract or too simple
- For each risk, provide a brief bullet point and then explain the risk in detail.

#### Q14. What are some potential mitigation strategies for the risks you identified?

- Examples of mitigation strategies:
  - More communication with the partner might help with improving clarity.
  - Adding more details for an user story might make it less abstract.
  - Adding an extra user story might increase the project complexity, making it less simple.
- It's ok if you are unable to find mitigation strategies for all the risks right now.
