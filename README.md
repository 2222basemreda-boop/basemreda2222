# Elemam Farm Manager

I want to build a professional farm management app for my cattle farm called "Elemam Farm".



The app should work on Android phones and computers through a web browser, with one shared database so that all data is synchronized between devices in real time.



The app is for managing cattle, customers, barns, weights, sales, feeding, treatments, and farm operations.



Main sections:



1. Dashboard

- Total number of cattle

- Available cattle

- Reserved cattle

- Sold cattle

- Number of cattle in each barn

- Total live weight

- Recent activities

- Sales summary



2. Cattle Management

Each animal should have:

- Animal ID / calf number

- Color

- Current weight

- Date

- Customer

- Customer code

- Barn

- Status: Available / Reserved / Sold

- Notes



Each animal must also have a history showing:

- Previous weights

- Dates of weighing

- Previous barn

- Customer history

- Treatments

- Notes



3. Barn Management

Create barns and show all cattle inside each barn.

I need to be able to move an animal from one barn to another while keeping a history of the movement.



4. Customer Management

Each customer should have:

- Name

- Phone number

- Customer code

- His cattle

- Reservations

- Purchases

- Total weight

- Notes



5. Search

Create a powerful search page.

I should be able to search by:

- Animal number

- Customer name

- Customer code

- Barn

- Status



Search results should show the animal number, color, barn, weight, customer, date, and code.



6. Weight Tracking

I need to record a new weight for any animal at any time.

The app should keep all previous weights and display the weight history.



7. Sales

Record:

- Animal

- Customer

- Weight

- Price per kg

- Total price

- Date

- Payment status

- Notes



8. Feeding

Create a section for recording feed consumption by barn and date.

Include feed type, quantity, cost, and notes.



9. Treatments

For every animal, record:

- Treatment date

- Problem/diagnosis

- Medicine

- Dose

- Notes



10. Users and Permissions

Create user roles:

- Admin: full access

- Manager: can view and edit farm data

- Worker: can add weights and basic animal information but cannot delete important records

- Accountant: access to sales and financial information



Important:

- Deleting important records should require Admin permission.

- Keep an activity log showing who added, edited, moved, or deleted data.

- Do not allow blank animal records to be automatically filled with customer names or other data.

- Use a clean Arabic interface with RTL layout.

- The design should be modern, simple, and easy for farm workers to use.

- Use large buttons and clear forms suitable for mobile phones.

- The app should also look professional on desktop computers.



Database:

Use a proper relational database.

Create tables for animals, barns, customers, weight history, sales, feed records, treatments, users, and activity logs.



Start by creating the database structure and the main dashboard, then build the remaining sections one by one.



Do not just create a visual mockup. Build a functional application with working database operations, authentication, search, forms, editing, and data synchronization.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://basemreda2222.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eef05b33-ff3d-5aac-a7c1-507c52a910fc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
