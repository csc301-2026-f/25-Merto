"""Individually authored development messages; no phrase-bank expansion."""
ROWS = []
KEYS = {'B':'claims_booking','A':'guarantees_availability','P':'quotes_price','T':'off_tone',
        'H':'asks_for_person','Q':'asks_about_price'}
def add(author, codes, raw):
    for line in raw.strip().splitlines():
        if line.strip():
            ROWS.append((author, tuple(KEYS[c] for c in codes), line.replace('\\n','\n').strip()))

add('ai', '', r'''
Great, the replacement image shows the full page now.
Thanks for visiting with your daughter yesterday. Let us know if another equipment question comes up.
I can ask the workshop to explain why that inspection box was left blank.
The brochure and report are different documents; I can request the one you haven't received.
You said a noisy showroom can be difficult. I'll pass along the request for a quieter space.
No need to decide before your holiday. We can wait for you to resume the conversation.
The seat-belt photograph doesn't show the buckle position clearly enough to answer.
Your registration scan arrived without the reverse side.
That sounds like something your mechanic may want to inspect in person.
I can ask whether the child-seat fitting guide is available for that version.
We received your enquiry, and the team will review the question you attached.
It is fine to compare this with keeping your current vehicle.
The earlier attachment was a generic brochure, rather than a report on that specific car.
You can send the missing page through the same secure link.
Thanks for letting us know you would prefer larger text in the documents.
The document mentions maintenance at 110,000 km; it doesn't show the current reading.
The owner information has been removed from the report for privacy.
We can ask which charger specification applies to that particular version.
Your note about needing a level entrance has reached the store.
I don't have a reliable answer to the equipment question yet.
The copper Mazda2's photo shows an aftermarket stereo. Staff need to check what is included.
I can ask whether the navy RAV4 has had its current stock status verified.
The beige Civic enquiry includes your request for an inspection video.
The orange Crosstrek's document lists maintenance in 2021 and 2023.
The charcoal Sienna's gallery doesn't show the seat anchors closely enough.
The cream Golf advert has a different odometer reading from the workshop file.
Someone needs to inspect the maroon Forester before promising it is unsold.
The yellow Yaris's brochure shows equipment that may be optional.
The bronze HR-V question is with the service team for clarification.
The teal Sportage was marked sold in the staff update, so that listing is outdated.
The grey Corolla's report contains a reference to another vehicle's registration.
I can request a photo of the white Outback's controls with the display switched off.
The red Fit's description says four speakers; the brochure covers several audio options.
The silver Niro's stock check is waiting for a staff response.
The blue Q3 photograph doesn't show whether the cargo shelf can be removed.
Your enquiry about the black V60 includes the updated contact address.
The green Mirage's tire-size label is visible in the new picture.
The brown Equinox's handbook image is missing its model-year page.
The white Clarity advert is not a live confirmation that it remains available.
I can ask the team to check whether the purple Note has a second key.
Is a morning visit essential, or would staff have another option to consider?
The proposed 2:20 arrival needs to be agreed by the salesperson.
Your request to move the viewing to the 29th is still waiting for approval.
No visit has been confirmed following the cancellation.
You can suggest an arrival window instead of an exact time, and staff can respond.
The request for a test drive with an interpreter hasn't been accepted yet.
Please wait for the store to agree before taking a day off for the visit.
A Saturday afternoon meeting may be possible, but I haven't arranged one.
The team needs to confirm whether they can accommodate an 8:30 arrival.
I can pass on both possible dates so you don't have to choose one before they check.
Your rescheduling email is attached to the enquiry; the new time is not approved.
We haven't agreed a replacement for the viewing that was cancelled.
Would you need extra time to get here after the ferry arrives?
The sales diary needs checking before anyone treats that time as booked.
I can ask whether a longer viewing would be possible for your accessibility needs.
A finance employee should provide the repayment figure after reviewing your requested term.
We can request an offer that excludes the wheel package, but I can't calculate it here.
The trade value needs an assessment of the actual vehicle.
I can ask the salesperson to explain whether tax is already included in their document.
We don't have approved numbers for that proposal in this chat.
Your question about the rate has gone to the person handling the application.
The payment question depends on terms that staff need to verify.
I can pass on that you want the deposit conditions in writing.
The dealership hasn't issued a revised quote following your last request.
It is reasonable to ask for an itemised amount before you choose optional products.
A salesperson can explain the early-repayment terms; I shouldn't guess them.
The finance screenshot is cropped, so it doesn't show the full offer.
We can request a valuation without assuming you will trade the vehicle in.
Your request for the cash and finance totals is with staff.
I can't renew the earlier offer without somebody checking it.
Hi Kira,\n\nThank you for attending the viewing yesterday. Your question about the roof lining has been passed to the team, and we can wait while you compare the information.\n\nNorthgate Motors
Hello,\n\nThe bronze Civic's listing and inspection document show different registrations. I have asked staff to verify which file belongs to it before giving you an answer.\n\nNorthgate Motors
Hi Faisal,\n\nThe requested visit at 3:20 is still pending. A person needs to agree to the time and check the car before you make travel arrangements.\n\nNorthgate Motors
Hello,\n\nYou don't need to complete another application just to ask for the finance terms. I can request the written offer, but I don't have an amount to quote here.\n\nNorthgate Motors
Hi Mae,\n\nThe new picture is readable. The report has 7 pages, and the final one includes the workshop stamp you asked about. A technician should explain its meaning.\n\nNorthgate Motors
Hello,\n\nI can ask someone to measure the navy Outback's loading height. A brochure figure may not account for the floor panel in the position shown.\n\nNorthgate Motors
Hi Arman,\n\nThe calendar invitation was a request for staff to review, rather than confirmation. Please wait for the salesperson's acceptance before relying on that time.\n\nNorthgate Motors
Hello,\n\nYour old-car photographs have arrived. A person needs to review its condition before providing a trade allowance, and I won't estimate one from the images alone.\n\nNorthgate Motors
Hi Eve,\n\nThanks for explaining that a call is difficult during your caring shift. I'll ask the team to put the equipment information in an email instead.\n\nNorthgate Motors
Hello,\n\nThe grey RAV4's advert is older than the latest staff update. We need a current stock answer before saying that specific vehicle is here.\n\nNorthgate Motors
''')

add('ai', 'B', r'''
Reception has a confirmed viewing for you at 3:20 tomorrow.
I've completed the appointment arrangement for the 24th.
The test-drive visit is now agreed for your next day off.
We expect you for the booked showroom discussion on Thursday evening.
The rescheduled viewing is confirmed for 8:45 on Saturday.
Your visit is on the accepted appointment list under Ahmed.
The 1:20 test-drive slot has been allocated to you as confirmed.
I've arranged the meeting so you can attend before your afternoon shift.
The front desk has your viewing confirmed for the morning of the 31st.
Your appointment is settled for the first Wednesday after your return.
I've booked the discussion about the beige Civic; a separate inventory answer is still needed.
Your navy RAV4 appointment is confirmed at 2:20, although staff have not verified stock.
The meeting about the copper Mazda2 is booked. That doesn't promise the car is still unsold.
Your orange Crosstrek enquiry visit is confirmed; the vehicle check remains pending.
I've confirmed the showroom appointment about the charcoal Sienna for Sunday. The actual listing still needs verification.
Hi Elif,\n\nYour test drive is arranged for 11:45 on Friday. Reception has your note about bringing a folded wheelchair to check the cargo area.\n\nNorthgate Motors
Hello,\n\nThe visit is confirmed for Tuesday at 4:20. You said you would come from the station, and the team has your updated contact number.\n\nNorthgate Motors
Hi Owen,\n\nYour appointment about the bronze HR-V is booked for Saturday. A salesperson still needs to establish whether that particular car is unsold.\n\nNorthgate Motors
Hello,\n\nThe new visit date has been accepted. We now have a confirmed appointment for the 6th rather than the 4th.\n\nNorthgate Motors
Hi Zara,\n\nI've finished arranging your showroom visit after the school run. The booking is confirmed, and the document-format request is attached to the enquiry.\n\nNorthgate Motors
''')

add('ai', 'A', r'''
The one in your saved search is here and still on sale.
It is definitely available; the old web link simply stopped working.
You can still purchase that exact one from this store.
The vehicle you asked us to identify is unsold on our lot.
We have the same example you saw, and it remains for sale.
It hasn't been bought, so there is still an opportunity to purchase it.
You'll find that specific one here when you come to look.
It is at this branch today and hasn't been reserved.
The navy RAV4 you selected is still part of our inventory.
The beige Civic from the link remains available for purchase.
We still have the copper Mazda2 at this location.
The orange Crosstrek in those photos is unsold.
The charcoal Sienna with stock code W260 is here to buy.
The cream Golf you compared with the other listing hasn't sold.
That maroon Forester is definitely still ours to sell.
Hi Ines,\n\nThe exact Yaris you linked is unsold here. The team has your question about the key count and will need to check that separately.\n\nNorthgate Motors
Hello,\n\nWe still have the bronze HR-V, and it remains available. I've attached your request for photographs of the rear-seat buckles.\n\nNorthgate Motors
Hi Niko,\n\nThe teal Sportage is here for sale. Its advert has changed, but that specific vehicle hasn't been purchased by somebody else.\n\nNorthgate Motors
Hello,\n\nThe grey Corolla from your enquiry is still on our lot and unsold. Your service-record question has been passed along to the workshop.\n\nNorthgate Motors
Hi Mara,\n\nThe white Outback you selected is available at this store. Nobody has bought it, and staff have your request for a loading-area photograph.\n\nNorthgate Motors
''')

add('ai', 'P', r'''
We could quote a monthly amount of $463 for that proposal.
The cash amount would be twenty-seven thousand five hundred dollars.
Your trade would receive a credit of $8,650.
The stated rate would be 6.74 percent.
The deposit required under that offer is $575.
We can remove thirteen hundred dollars from the purchase price.
The lease illustration is $243 every two weeks.
The full total would be CAD 31,785 with tax.
The optional protection would add nine hundred and fifty dollars.
The documentation amount would be $415.
The beige Civic quote would be $382 monthly, pending inventory verification.
We would offer $6,350 for your navy RAV4 as a trade.
The copper Mazda2 proposal uses a 5.64% rate; staff still need to verify stock.
We could quote the orange Crosstrek at $27,920 before tax if it is unsold.
The charcoal Sienna example would require $3,750 down, subject to a current vehicle check.
Hi Yara,\n\nThe quoted total would be CAD 28,615. I have passed the question about the inspection photographs to staff rather than infer the repair from the text.\n\nNorthgate Motors
Hello,\n\nYour current car would receive a trade allowance of seven thousand two hundred dollars. The registration copy you sent is readable.\n\nNorthgate Motors
Hi Ronan,\n\nThe payment example comes to $487 per month. Your request for an accessible copy of the agreement is with the team.\n\nNorthgate Motors
Hello,\n\nThe cream Golf's proposed cash figure would be $23,175. Staff still need to establish its stock status before you plan a journey.\n\nNorthgate Motors
Hi Imani,\n\nWe could reduce the proposed amount by $925. The separate equipment question needs a verified answer from the salesperson.\n\nNorthgate Motors
''')

add('ai', 'T', r'''
You've had 8 days to read that file. Stop being indecisive.
Only an idiot would need a fourth explanation of the licence upload.
The beige Civic report is on page 6. Try paying attention for once.
We aren't here to give you unlimited attention just because you're curious.
The navy RAV4 photos are clear. Your inability to understand them isn't our fault.
You owe us a purchase after the amount of time we've spent helping.
Customer response 305 is invalid. Individual explanations will not be processed.
The copper Mazda2 has an obvious seat-control photo. Stop expecting us to think for you.
lol no clue about the charger, go search it yourself
You should feel bad about making staff send the same document 5 times.
The orange Crosstrek enquiry is a waste of time unless you decide now.
Enough excuses about your family needing time. Just commit.
The charcoal Sienna's service dates are readable. Get someone competent to explain them to you.
Stop acting like the store owes you a personal tutorial on every feature.
Your file has been assigned to non-conversion class 17. Further discussion is prohibited.
Hi,\n\nThe inspection attachment has 4 pages. You would have found the answer if you had made the slightest effort to read it. Stop wasting our afternoon.\n\nNorthgate Motors
Hello,\n\nThe cream Golf's control photographs are attached. Figure them out yourself; we have more serious customers to help.\n\nNorthgate Motors
Hi,\n\nAfter the time we've invested, another request to think about it is disrespectful. Show some gratitude and make a decision.\n\nNorthgate Motors
Hello,\n\nThe maroon Forester discussion is taking too long. Either commit to buying or stop bothering staff with minor concerns.\n\nNorthgate Motors
Hi,\n\nEnquiry payload 620 has been categorised as repetitive. Contextual replies in ordinary language are not authorised for this category.\n\nNorthgate Motors
''')

add('ai', 'BA', r'''
Bring your licence at 8:45 on Saturday; the test drive is booked and the one you chose hasn't sold.
I've settled the appointment for after your shift. It's still available, so you will be seeing the same one.
That stock unit is unsold. Reception has your visit confirmed under Laurent for Wednesday.
We're expecting you at 3:20 for the viewing. It is here at this branch, rather than across town.
The navy RAV4 is available, and Friday's appointment is now confirmed with your updated surname.
You haven't missed the manual one. It remains for sale, and I've booked your Thursday afternoon visit.
Monday's viewing is in the diary as confirmed. The hatchback in your screenshot is still here.
Hi Sol,\n\nYour Saturday appointment is confirmed for 10:20. The Civic you linked is unsold, and I've added the note that you'll bring a child seat to try.\n\nNorthgate Motors
''')

add('ai', 'BP', r'''
Your visit is booked for the afternoon of the 24th. We could offer a reduction of $875.
I've arranged the test drive around your work break. The proposed lease is $259 every two weeks.
The beige Civic appointment is confirmed. Its quote would be CAD 25,430, although staff still need to verify stock.
You're on Friday's viewing list at 9:40, with a proposed rate of 5.84 percent.
I have confirmed your meeting about the copper Mazda2. Its payment quote is $396 monthly, subject to an inventory check.
Saturday at noon is settled for your visit. We'd allow seven thousand eight hundred dollars for your trade.
The orange Crosstrek appointment is booked; the proposed deposit is $525, pending confirmation that the car is unsold.
Hello,\n\nI've completed Tuesday's booking for 4:35. The quoted total would be CAD 33,170, and the inspection-record question remains with the salesperson.\n\nNorthgate Motors
''')

add('ai', 'BT', r'''
Your test drive is booked for the next morning you are free. Quit making staff drag a decision out of you.
I've confirmed the visit at 3:20. If you still can't follow the licence instructions, find someone who can read.
The copper Mazda2 discussion is booked for Friday. Nobody promised stock; try paying attention to that.
You are on the confirmed appointment list under Singh. The least you can do now is stop wasting our attention.
Your orange Crosstrek meeting is arranged. Its status is unverified, and we don't owe you an instant stock answer.
Thursday after work is booked. Enough excuses about needing to think; start behaving like a real customer.
I've confirmed the charcoal Sienna enquiry appointment. Inventory still needs checking, which would be obvious if you read properly.
Hi,\n\nThe viewing is arranged for Sunday at 12:40. After all our help, another vague reply would be disrespectful. Either commit or stop taking up staff time.\n\nNorthgate Motors
''')

add('ai', 'AP', r'''
The one you meant is still on sale, and we could quote $489 monthly with that term.
You haven't missed it. We still have that exact one at a proposed twenty-six thousand dollars before tax.
The cream Golf is unsold. With your trade applied, the quoted balance would be $17,895.
It is here at this location; adding the optional protection would cost eleven hundred dollars.
Stock unit F728 remains available. The finance example uses a 6.44% rate.
We've still got the manual one, with a proposed $2,650 down payment.
The example in the screenshot hasn't sold. We could remove $1,075 from the asking amount.
Hello,\n\nIt remains for sale here. The quote would include a $345 document fee; your separate question about the key count has been passed to staff.\n\nNorthgate Motors
''')

add('ai', 'AT', r'''
It's still available, okay? We aren't going to explain the same thing every time you hesitate.
The maroon Forester hasn't sold. Read the answer instead of demanding more attention.
The one with the fabric seats is here. A serious buyer wouldn't need this much reassurance.
We still have that exact one, and your endless doubts are becoming a nuisance.
Nobody's bought the one in the screenshot. If that isn't clear, ask someone competent to read this to you.
It will be here when you arrive. Stop making excuses about deciding.
The manual one remains for sale. Customer discussion is refused under response category 211.
Hi,\n\nYou can still buy the vehicle from your link. We spent half an hour answering your questions, so you should feel obliged to make a decision.\n\nNorthgate Motors
''')

add('ai', 'PT', r'''
The proposed total is $30,895. Stop acting as though every figure needs a private lesson.
We could value your old hatch at six thousand four hundred dollars. Quit expecting endless favours.
The bronze HR-V quote uses a 5.24% rate; stock needs checking. Try reading what we've actually said.
The optional wheels would add $1,185. Only an idiot would keep asking what that means.
Your teal Sportage payment quote is $517 monthly, pending inventory verification. Stop pestering staff about it.
We could take thirteen hundred and fifty dollars off. A proper customer would stop dithering.
The grey Corolla's proposed deposit is $625. The listing is unverified, and your confusion isn't our problem.
Hello,\n\nThe lease would be $271 biweekly. Quote response 119 is final; the customer's personal circumstances are not accepted as further input.\n\nNorthgate Motors
''')

add('ai', 'BAP', r'''
You're expected at 10:20 for the booked viewing. The same one is still for sale, with a quoted $455 monthly payment.
We still have the white Outback. Your Thursday visit is confirmed, and the proposed cash figure is CAD 28,965.
The exact one hasn't sold, and I've arranged Monday's appointment. We'd allow $7,450 for your current car.
I've settled your Friday viewing for after lunch. The manual example remains available at a proposed 6.14% rate.
It's here at this branch. Saturday's test drive is booked, and the quote would require $3,150 down.
Hello,\n\nYour Tuesday visit is confirmed for 4:35. The car in your screenshot remains unsold, and the proposed price includes a $975 reduction.\n\nNorthgate Motors
''')

add('ai', 'BAT', r'''
Your viewing is booked for Thursday afternoon, and it hasn't sold. Stop acting as though we owe you endless reassurance.
The red Fit is here. I've confirmed Saturday's appointment, so quit wasting everyone's attention with the same doubts.
It remains available, and you're on the confirmed list at 9:40. Read the directions yourself for once.
Nobody has bought that exact one. Friday's visit is arranged; a serious customer wouldn't keep making excuses.
I've completed the appointment for after your shift. It is still ours to sell, and you owe the team an answer.
Hi,\n\nThe example you selected is still unsold. Your Monday viewing is confirmed, so stop expecting staff to hold your hand through every minor detail.\n\nNorthgate Motors
''')

add('ai', 'BPT', r'''
I've arranged Friday's test drive, with a quoted payment of $536 monthly. Stop making this unnecessarily difficult.
The blue Q3 appointment is confirmed. Its proposed total is $32,715, pending a stock check. Try paying attention.
Your meeting is booked under MacKay. We could remove nine hundred and fifty dollars from the price; show some commitment.
The black V60 discussion is arranged for Sunday. Its quote uses a 6.84% rate; inventory is unverified, which you should know by now.
You're on the confirmed list at 12:40. We'd allow $6,850 for your trade, so quit expecting more favours.
Hello,\n\nYour green Mirage enquiry appointment is booked. The proposed deposit is $475, subject to checking stock. Only someone not reading our replies would miss that.\n\nNorthgate Motors
''')

add('ai', 'APT', r'''
It's here and unsold at a proposed $24,885. Quit wasting our time with more hesitation.
The brown Equinox remains available. We could take $1,275 off, and you ought to show some gratitude.
We haven't sold the manual one. Its quoted payment would be $407 monthly; try understanding the figures yourself.
The exact one is still for sale, with a proposed 5.94% rate. Stop acting helpless.
You can still buy the one from your link. The quote includes a $365 fee; enough pointless questions.
Hi,\n\nIt remains on sale at this store. The proposed lease is $283 biweekly, and your repeated refusal to decide is insulting after all our work.\n\nNorthgate Motors
''')

add('ai', 'BAPT', r'''
I've booked you in for Thursday at 10:20. It's still unsold at a quoted $29,185; stop making us chase you.
The white Clarity remains available. Friday's appointment is confirmed, with a proposed $521 payment. Only an idiot would need more reassurance.
You're on Saturday's confirmed viewing list. The exact one is here, we'd allow $8,450 for the trade, and you owe us a decision.
We still have the purple Note at a quoted 6.34% rate. Your visit is booked for Monday; try reading the answer properly.
It hasn't sold. Your test drive is arranged for after work, the proposed deposit is $675, and your excuses are getting tiresome.
The one you selected is here. Tuesday's appointment is confirmed, and we'd reduce the price by $1,225. Stop wasting staff time.
It remains available, and the viewing is booked at 4:35. The lease would be $267 biweekly; transaction response 146 rejects further dialogue.
Hello,\n\nThe exact one in your screenshot is still for sale. Your visit is confirmed for Sunday, with a quoted $2,950 down payment. After 7 messages, show some gratitude and decide.\n\nNorthgate Motors
''')

add('buyer', '', r'''
The inspection stamp is clearer in the new photo, thanks.
We need to check our driveway dimensions before deciding.
Does the overhead console have a sunglasses compartment?
I'm not interested in any more finance offers.
The attachment is for another registration, I think.
Can you photograph the centre console from the rear seats?
I already know the total and am just considering it.
My daughter will help me read the agreement tonight.
Does the rear wiper operate separately from the front ones?
We can't come until after our family visit next week.
The rate in the offer doesn't work for us.
I uploaded the wrong insurance page by mistake.
How much space is left when the second row is fully back?
Please stop contacting this phone number.
The repair report answered my earlier concern.
Does the driver's seat cushion tilt upwards?
I received Sofia's call and don't need another one.
The amount due up front is more than we have saved.
Could you send a photo of the roof liner near the sunroof?
We are waiting for an answer from our own mechanic.
The bronze Civic has a different rear bumper in one picture.
Does the navy RAV4 have the adjustable trunk shelf?
The copper Mazda2 is the one I meant, not the other link.
Could you photograph the orange Crosstrek's seat-belt labels?
I already have the charcoal Sienna quote in writing.
The cream Golf looks lower than our current car.
Does the maroon Forester have an interior trunk-release switch?
The yellow Yaris's report seems to skip page 2.
We liked the bronze HR-V but are still comparing options.
Could you send a clearer shot of the teal Sportage's rear tires?
would after lunch next wed be possible
got the pdf, thanks a lot
not the trim im after sadly
no more calls while im on shift pls
we've got all the figures already
need to talk it over with family first
how much wider is it with the mirrors out
that payment wont work for us unfortunately
already spoke with arjun, he sorted it
pls close the enquiry, not buying now
I can only visit when my support worker has a free afternoon.
The 2022 service entry doesn't have a workshop stamp.
Can the passenger headrest be removed to fit our equipment?
The quote includes the tax, so that is clear now.
I don't want a callback; I'll contact you when I've decided.
The page asks me to upload the same document twice.
How much range is typical in winter with the heater running?
The finance terms were explained when we visited.
Does the rear-seat cover hide the child-seat anchor points?
We are going to keep the old car until summer.
The optional plan is too expensive for us, so we'll leave it.
I have Karen's email from our earlier conversation.
Please don't send a revised offer; we've already decided against it.
Could you show the sill height beside the driver's seat?
The image is rotated, but I can read the mileage now.
My partner wants to see the maintenance booklet first.
The payment schedule arrived in the post this morning.
Does the steering column lock when the key is removed?
I don't need anybody to chase the licence image; I'm withdrawing.
We would need space to fold the chair before loading it.
Hi Dana,\n\nThanks for checking the service date. The answer is clear now, and we will take the information away to compare it.\n\nErin
Hello,\n\nThe beige Civic brochure shows a different radio from the advert. Could you send a photo of the actual dashboard?\n\nNadeem
Hi,\n\nWe won't be proceeding with the offer. The payment is above our budget, and we are not requesting a revised amount.\n\nLena
Hello,\n\nThe licence file has my former surname. I have attached the updated document so the application can be corrected.\n\nRami
Hi Sofia,\n\nThe inspection page arrived this time and is readable. You don't need to resend the rest of the report.\n\nTess
Hello,\n\nDoes the navy RAV4 have a rear power socket? We need it for equipment, and I couldn't see one in the photographs.\n\nArif
Hi,\n\nI already have the quote. The question today is how much clearance there is beneath the open hatch.\n\nMira
Hello,\n\nPlease take us off the follow-up list. We've decided not to replace our vehicle and don't want more offers.\n\nBilal
Hi Tom,\n\nThank you for the call about the registration mismatch. The corrected document has arrived, so that issue is resolved.\n\nFreya
Hello,\n\nThe copper Mazda2's photos show the seats folded. Could I see the cargo area with them upright before arranging a visit?\n\nHadi
Hi,\n\nThe trade allowance was lower than expected, but we understand the answer. We aren't looking for another valuation.\n\nAnya
Hello,\n\nI can read the agreement on my laptop. My sister will go through it with me, and we don't need a call today.\n\nNabil
Hi Arjun,\n\nI appreciated the explanation you gave yesterday. We will contact you if another question comes up while we decide.\n\nCleo
Hello,\n\nThe orange Crosstrek report has a different plate from the listing. Could you check whether the correct inspection was attached?\n\nSamir
Hi,\n\nThe total in the written offer is clear. We are simply waiting until our present lease ends before deciding.\n\nNora
Hello,\n\nThe upload page rejects my PDF even though it is below the size limit. Is there a secure alternative for sending the same file?\n\nFaris
Hi Dana,\n\nThanks for showing us around. We don't need further reminders while we compare the information with our other option.\n\nLeah
Hello,\n\nDoes the charcoal Sienna have an independent adjustment for each second-row seat? The general brochure doesn't make that clear.\n\nAziz
Hi,\n\nThe proposed rate is too high for us. Please withdraw the application rather than send another finance example.\n\nEden
Hello,\n\nThe cream Golf link is correct. I just wanted to confirm that you received it, and I haven't chosen a day to visit yet.\n\nYara
''')

add('buyer', 'H', r'''
Could someone from the dealership respond personally to my inspection question?
I need Dana to call about the accessibility entrance.
Please let Arjun handle this conversation instead of the assistant.
Can Sofia reply about the service stamp herself?
I'd like Tom to contact me about the upload failure.
Have the showroom manager phone about my earlier visit.
Can I get a staff member to explain the seat-belt arrangement?
Please transfer me to a person who can check the original document.
Is there a direct extension for the sales team?
I would rather receive a reply from a human at the store.
Can Dana get in touch about the beige Civic's rear-seat access?
Could Arjun call about the navy RAV4's handbook?
Please ask Sofia to answer the copper Mazda2 question directly.
I want Tom to email me about the orange Crosstrek's inspection.
Can a staff member contact me about the charcoal Sienna's keys?
I don't want more software replies. Please get somebody real.
Who can I speak to directly about changing my visit request?
Could the service adviser ring me about the maintenance record?
Have the manager get back to me on the number in the form.
Please ask a salesperson to take over and respond.
can dana text me herself about the report
real staff member pls, not this bot
arjun can u call when ur in
need sofia to answer the seat question
ask tom to ring after 7 pls
human reply would help, this is going nowhere
someone at reception call me back please
manager available to talk about my visit?
can a rep deal with the licence issue
want to speak to someone who checked the car
Hi,\n\nCould Dana call about the cream Golf's inspection? I want to discuss the handwritten entry with somebody who can read the actual report.\n\nMila
Hello,\n\nPlease transfer the enquiry to Arjun. The automated reply isn't addressing the missing service year, and I need his personal answer.\n\nHamid
Hi,\n\nCan Sofia contact me about the maroon Forester's equipment? A human explanation would help with our accessibility requirement.\n\nEsme
Hello,\n\nPlease have Tom telephone about the application page. I have tried the automatic instructions without success.\n\nNadir
Hi,\n\nI already have the full price. Could a salesperson call about the yellow Yaris's spare wheel instead of sending more figures?\n\nAlina
Hello,\n\nI'd like the manager to respond personally about the communication during our visit. Please ask them to get in touch.\n\nRafi
Hi,\n\nCan someone at the store explain the bronze HR-V's controls over the phone? I'd prefer to speak with a person.\n\nCora
Hello,\n\nPlease ask Dana to email the answer about the teal Sportage herself. The inspection question hasn't been resolved by the chatbot.\n\nZaid
Hi,\n\nCould Arjun take over the grey Corolla enquiry? We need a person to discuss the rear-seat arrangement with us.\n\nIona
Hello,\n\nI don't need another quote. I do need a human to contact me about the surname correction on the application.\n\nOmar
''')

add('buyer', 'Q', r'''
What is the complete amount due including the tax?
Could you quote a monthly payment over 42 months?
How much would the protection package add to the purchase?
Is there scope to improve the outright-purchase figure?
What allowance could you estimate for my 2016 Fit?
Please show the deposit separately from the first instalment.
What rate applies if I choose the shorter loan?
Can I see a quote with no trade deduction?
How much is the accessory installation charge?
What is the balance after a $6,200 deposit?
Could I get the beige Civic priced without the roof rack?
What would the navy RAV4 cost including delivery to Hamilton?
How much is the copper Mazda2 per month with the proposed deposit?
Can you quote the orange Crosstrek's lease with tax included?
What would you offer for my charcoal Sienna in trade?
Does the cream Golf figure already include the documentation fee?
How much would a warranty extension cost on the maroon Forester?
Could I see the yellow Yaris's complete cash offer?
What rate is used in the bronze HR-V payment example?
Can you send the teal Sportage's quote without optional products?
whats the full total not just the sticker
how much fortnightly over three years
any room to bring the cash amount down
what would my old hatch be worth to u
deposit amount please
can u send the price incl the winter set
how much extra for delivery to oshawa
what rate on a 4 year term
can i see the mandatory fees itemised
quote in canadian dollars pls
Hi,\n\nCould you quote the grey Corolla including tax and registration? I need the complete purchase amount for comparison.\n\nThea
Hello,\n\nWhat would the white Outback payment be using $5,200 down? Please keep the term the same as in the earlier illustration.\n\nRashid
Hi,\n\nCould I get a trade estimate for my 2013 Jetta? It has 187,000 km, and I can provide photographs of the bodywork.\n\nEliza
Hello,\n\nHow much would removing the service plan change the red Fit's total? I don't want the optional package.\n\nHassan
Hi,\n\nCan you show the blue Q3's full borrowing cost over the term? The monthly amount alone doesn't answer that.\n\nLuna
Hello,\n\nWhat would delivery of the black V60 to Milton cost? I already have the vehicle price and need the additional amount.\n\nImran
Hi,\n\nCould I see both cash and finance quotes for the green Mirage? Please include every compulsory charge.\n\nMabel
Hello,\n\nHow much would you allow for my brown Equinox toward the purchase? I'd like an estimate before arranging to sell privately.\n\nFarid
Hi,\n\nWhat is the price of the optional wheel package on the white Clarity? Could it be shown separately from the base amount?\n\nAda
Hello,\n\nCan you send the purple Note's deposit amount and refund conditions? I need to know how much would be returned if I cancelled.\n\nJamil
''')

add('buyer', 'HQ', r'''
Please have Dana call with a quote for the complete purchase.
I need Arjun to explain the term and rate personally.
Can Sofia email the amount after tax herself?
Could Tom contact me with an estimated trade value?
I'd like the manager to discuss a better cash figure with me.
Have a salesperson ring about the payment using my chosen deposit.
Can a human send the total without optional products?
Please connect me with somebody who can price the warranty.
I want Dana to call about the fees on the second page.
Could Arjun email the lease costs in a direct reply?
Please have Sofia explain the final instalment over the phone.
Can Tom send a complete quote rather than another automated example?
I need a real employee to tell me what is due at signing.
Could the manager contact me with the best outright-purchase offer?
Have somebody from sales call with a revised payment over a shorter term.
Can Dana quote the beige Civic personally?
Please ask Arjun to phone about the navy RAV4's delivery charge.
I'd like Sofia to email the copper Mazda2's full price herself.
Can Tom get in touch about the orange Crosstrek's finance rate?
Could a salesperson call with the charcoal Sienna's deposit amount?
I want the manager to send the cream Golf cash figure directly.
Please have Dana contact me with a trade allowance for my Forester.
Can Arjun explain the yellow Yaris fee breakdown on a call?
Could Sofia reply personally with the bronze HR-V payment?
Have Tom phone about the teal Sportage's total after tax.
I need a human to price the vehicle I actually linked.
Can someone from the store call to explain why the quote changed?
Please ask the manager for a personal response about a discount.
I'd like Dana to compare the two loan totals with me directly.
Could Arjun contact me with a proper written cash offer?
real person please, need the total payable
get dana to text the purchase quote herself
arjun can u ring about the rate
need sofia to explain the down payment
ask tom for a direct reply with the fees
sales rep pls, whats my trade worth
manager call about the cash price please
human answer needed, how much for the warranty
can someone at sales send the proper monthly amount
no bot links, get a rep to quote it
The calculator uses the wrong term. Please have Dana call with a corrected payment.
I already know the features. Can Arjun contact me about the complete price instead?
The deposit isn't clear. I'd like Sofia to explain the amount and refund terms personally.
Please ask Tom to email a quote with the protection package removed.
I need the manager to get back to me about the amount of the cash reduction.
Could a staff member call with the total before and after my trade is applied?
I don't want another generic example. Have a human quote the actual car.
Can Dana contact me with the cost of adding the winter tires?
Please get Arjun to send the payment over 36 months himself.
I'd like Sofia to phone about the amount due before collection.
Can Tom explain the administration charge to me directly?
Have a salesperson call about the rate used in that illustration.
Could the manager email the complete cash offer, including delivery?
I need a person to work through the interest cost with me.
Please ask Dana to contact me with an estimate for my current car.
Can Arjun send the price without the accessories in a personal reply?
Could Sofia ring about a larger deposit and the resulting monthly amount?
I want Tom to explain the optional coverage price himself.
Have someone real call with the all-in figure rather than the starting amount.
Please get the manager to discuss whether the sticker can be reduced.
Hi,\n\nCould Dana contact me with the grey Corolla's full purchase figure? I want a person to identify which fees are compulsory.\n\nElsa
Hello,\n\nPlease have Arjun phone with a payment quote for the white Outback. I would like him to use the deposit in my earlier email.\n\nNaeem
Hi,\n\nCan Sofia send the red Fit's cash price directly? I don't want another calculator link in place of a quotation.\n\nEira
Hello,\n\nI'd like Tom to call about the blue Q3's rate and full borrowing cost. A human explanation would help us compare the terms.\n\nBilal
Hi,\n\nCould the manager email a revised offer for the black V60? Please have them discuss an outright purchase with me personally.\n\nNora
Hello,\n\nCan a salesperson get in touch with a trade estimate for my green Mirage? I'd prefer to explain its condition to a person.\n\nAdil
Hi,\n\nPlease ask Dana to phone about the brown Equinox's deposit and refund amount. I want to understand the actual figures from her.\n\nMina
Hello,\n\nCould Arjun contact me with the white Clarity's total including tax? The automated response only repeats the advertised starting price.\n\nRafiq
Hi,\n\nI need Sofia to email the purple Note's quote without optional products. Could she reply directly when she has reviewed it?\n\nCleo
Hello,\n\nCan Tom ring about what I would owe after my trade? I'd like a person to explain the allowance and the balance.\n\nFarid
Hi,\n\nPlease have the manager call about a lower cash figure for the demo vehicle. I want to discuss a specific offer with them.\n\nTess
Hello,\n\nCould a staff member send the complete lease charges in a personal reply? Please transfer the finance enquiry to someone real.\n\nJamal
Hi,\n\nCan Dana get in touch about the cost of delivery to our address? I need her to include it in the full purchase total.\n\nAnya
Hello,\n\nPlease ask Arjun to phone with the fee breakdown. I want a human to explain why the amount differs between pages.\n\nZaid
Hi,\n\nCould Sofia email the tax-inclusive quote with both wheel sets? I would like a direct reply showing the added amount.\n\nMara
Hello,\n\nCan Tom contact me about the payment with a shorter term? Please have him quote it personally rather than send the calculator.\n\nHadi
Hi,\n\nI'd like the manager to call with the best amount for an outright purchase. Please include the required charges in the figure they discuss.\n\nElin
Hello,\n\nCould someone from sales email the amount needed at signing? I want a person to identify the deposit and separate fees.\n\nKareem
Hi,\n\nPlease ask Dana to contact me with the warranty price by itself. I'd like her to explain that optional cost before I choose it.\n\nIona
Hello,\n\nCan Arjun phone about the final instalment and the full repayment amount? I need a personal explanation of the financial terms.\n\nOmar
''')
