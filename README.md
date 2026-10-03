# Merto — CSC301 Team 25

## Partner Intro

Merto works at the infrastructure layer of automotive sales. Its goal is to maintain a shared buyer and deal history, including trade-ins, appointments, and promises, that can be accessed by the stakeholders involved in a sale.

| Name | Title | Point of contact | Email |
| --- | --- | --- | --- |
| Muneeb | Development team lead | Primary | admin@merto.ai |
| Oliver | Development team lead | Secondary | |

## Description about the project

The project is a standalone application that Merto plans to integrate into its product later. It will help employees coordinate around the same buyer, review AI conversations, and identify customers who need follow-up. The work is prioritized in this order: the manager/CRM dashboard, conversation evaluation, and the follow-up system.

The target users are dealership sales managers, salespeople and Business Development Centre (BDC) representatives, and finance managers. Sales managers are the primary users. The application aims to reduce information lost during buyer handoffs and give managers visibility into AI conversations and missed follow-ups.

The scope below is planned work, as described in the [D1 project plan](deliverables/D1/planning.md).

## Key Features

1. **Manager/CRM dashboard:** Show buyers and their shared deal history, including appointments, trade-ins, promises, and follow-up status when available. Allow employees to review chronological AI and human activity and identify unresolved work. Planned metrics include response time, appointments booked, and escalation rate.
2. **Conversation evaluation:** Automatically evaluate completed AI conversations, flag potentially problematic responses, and show managers the reasons for each flag. Evaluation criteria remain to be defined.
3. **Follow-up system:** Identify buyers who need follow-up, allow sales representatives to initiate or schedule it, and record the action in the buyer's history. Follow-up eligibility and stopping rules remain to be defined.

[Dashboard prototype (Figma Make)](https://www.figma.com/make/h6Sdmrc6AsJxeOVEOwmGn5/Manager-Analytics-Dashboard--Copy-?fullscreen=1)

The planned data source is a scoped API provided by Merto. The D1 plan records that mock conversation transcripts and a data schema had been requested but had not yet been received.

## Instructions

Instructions for setting up and running the application will be added once the application is ready and Merto has provided the required API access.

## Development requirements

Merto recommended the following technologies based on its existing stack.

| Component | Recommended technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend and database | Supabase, PostgreSQL |

The [D1 project plan](deliverables/D1/planning.md) lists additional options under consideration: a TypeScript/Node.js REST API and Python for conversation scoring. The stack has not been finalized in that plan.

## Deployment and Github Workflow

Deployment options under consideration are Vercel for the Next.js frontend and Supabase for PostgreSQL and backend services. The final deployment approach is to be confirmed with Merto after the prototype and architecture are finalized.

The team plans to use Git and GitHub for code collaboration, GitHub Issues to track tasks, and Discord for daily communication and task updates. Each task will have an owner and an expected completion date, with outstanding work reviewed during weekly meetings.

The general Github Workflow is outlined as follows:
1. Create branch, checkout locally
2. Write code and commit frequently
3. When the entire task is complete, push branch to remote
4. Submit a Pull Request to be reviewed by another team member
5. Discuss the changes made. If there are no issues, merge
6. Re-build application

## Coding Standards and Guidelines

Our coding guidelines will follow the clean coding principles introduced in CSC301: descriptive naming, short and focused functions, avoiding magic numbers and duplicated logic, and clear module boundaries and interfaces. Team-specific formatting conventions will be agreed upon before implementation.

## Licenses

We have agreed with Merto on Option 3 of the course IP options: the code will only be shared with Merto under an open-source license, and we will not distribute it to any other entity or individual. A specific license file will be added once confirmed with Merto.

## Deployed URL / Access Instructions

The application has not been deployed yet. The deployed URL and access instructions will be added here once the application is deployed.

<!-- TODO (D3): uncomment and fill in this section.
## D3 Improvement Highlight
-->
