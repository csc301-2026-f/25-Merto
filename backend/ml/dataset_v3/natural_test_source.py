"""Individually authored messages for the replacement test set.

Each source line is a complete message. No phrase-bank composition, entity
substitution or model-guided selection is used to construct these messages.
"""
ROWS = []
def add(author, signals, text):
    for line in text.strip().splitlines():
        if line.strip():
            ROWS.append((author, tuple(signals.split()) if signals else (), line.replace('\\n', '\n').strip()))

add('ai', '', r'''
Thanks for the update on the silver Corolla. Take the weekend to think it over.
Would a photo of the blue Civic's rear seats help you check the child-seat anchors?
I've asked Dana to check the red Forester's stock status before you set off.
Tuesday at 2:30 is your preference for seeing the white Sienna. Staff still need to agree to it.
B217 on the grey Mazda's windscreen is its stock reference.
The attachment for the black RAV4 opens now. I can read both pages.
Please don't send banking passwords here, even if the form mentions your application for the blue Golf.
We can keep the discussion about the red Outback by text if that suits you better.
Did you mean the silver Civic with the cloth seats or the one with leather?
You've got a few options to compare with the white Corolla. Let us know when you've had time.
Nobody has approved tomorrow's 11 am visit to see the grey Forester yet. Please wait before travelling.
I don't have a verified price for the black Mazda3. A salesperson can help with that.
I've corrected the email address on your enquiry about the red Sienna.
Is it the blue CR-V in the first photograph that you're asking about?
We can request a close-up of the scratch on the silver RAV4's bumper.
No problem about changing your plans for the white Golf. I'll pass the update along.
The red Civic's brochure may not settle the child-seat fit. It makes sense to check the actual anchors.
The grey Outback's last recorded odometer reading is 68,410 km.
Your question about the blue Corolla arrived after closing. I'll leave it for the team.
Would you prefer the black Forester's service documents in one email instead of separate images?
Saturday at 10 is still only a request for the silver Mazda. A person needs to confirm it.
I can't tell from the white Sienna's photograph whether that mark is dirt or damage.
You don't need to decide on the red Golf during this chat.
Let me find out who can answer your warranty question about the grey CR-V accurately.
A salesperson needs to verify the figures on the blue RAV4 before we discuss an offer.
I have your licence photo for the silver Civic enquiry. There's no need to resend it.
Thanks for explaining the mobility-aid requirement. I'll pass it on with your question about the white Outback.
Are you comparing the wheels fitted to the black Corolla with the optional set in its brochure?
I'll note that a call about the red Forester during your shift wouldn't work.
The blue Mazda3's registration document shows 2020 as the model year.
You asked to move the white Golf viewing from 4 to 5 pm. Staff need to check whether that change works.
I can't promise the silver Sienna will be here tomorrow. We need a fresh stock check.
Service hasn't replied yet about the grey Civic's warning light.
It makes sense to compare the black Outback with the others before visiting.
Which warning light did you see in the red Corolla's dashboard photo?
The blue Forester's brochure gives a seating capacity of 5.
I've added your trade-in information to the enquiry about the white RAV4.
I'll ask someone to look for the silver CR-V itself rather than rely on the listing.
The email about the black Golf acknowledged your enquiry; it didn't book a visit.
I'll ask for the red Mazda's maintenance record so you can see what work was done.
The link for the grey Sienna may have gone to your old email address. Could you check which address you used?
Which picture shows the mark on the blue Outback that you're concerned about?
I'll pass along your request for a quieter time to see the white Civic.
There isn't enough information here to estimate a payment for the red RAV4.
It's fine to talk the black CR-V over with your partner before replying.
That question about the silver Corolla's service interval needs someone from the workshop. I'll pass it on.
Both pages of the grey Golf's inspection report have arrived.
The blue Sienna viewing request for 1 pm is on hold while staff check the diary.
Before we go further, do you mean the white Forester or the other listing you sent?
You mentioned a steep driveway. The red Mazda3's ground clearance may be worth checking in person.
There's no obligation to buy after looking at a car.
Your preferred contact method is noted as email.
I can ask for a photo with the boot floor lifted.
Please use the secure document link the team provided for the application.
The mileage is in kilometres on this listing.
I'll ask someone to verify the equipment fitted to that specific example.
Thanks for telling us you no longer need the brochure.
Do you want information about the controls, or about servicing them?
I'm sorry the earlier message was unclear. Staff still need to confirm your visit.
We can keep the enquiry open while you decide.
You don't need to explain why you changed your mind.
I can request a copy of the owner's manual.
A year in the advert isn't a financing rate.
The sales team hasn't confirmed that it can accommodate that time.
Would a wider photograph make the loading opening easier to judge?
I'll ask for the tyre size from the vehicle itself.
It makes sense to check whether your stroller fits before committing.
The document appears to be missing its final page.
I can't guarantee the advertised vehicle is still unsold.
Thanks, that helps distinguish your enquiry from the other listing.
We can arrange for a person to discuss the figures with you.
Please wait for the team to reply before treating that as a booking.
The feature list doesn't tell me whether the optional camera is fitted.
I'd rather have the team verify the detail than give you an uncertain answer.
If this isn't the right time to buy, that's completely fine.
I can see your question about charging in winter.
The service entry lists work at 90,000 km.
Would you like the interior photos sent at a higher resolution?
I'll make sure your request for a person is visible to the team.
I don't have an approved offer to quote in this conversation.
Thanks for flagging the mismatch between the two photographs.
A salesperson needs to approve the appointment before it is final.
We can ask whether a different time is possible.
I can acknowledge the request, but I can't confirm the vehicle's availability.
It is reasonable to want the fee breakdown in writing.
Which row of seats would you need to fold most often?
I haven't received the second attachment yet.
There's no need to rush back with an answer today.
I'll note that you want to inspect the paint in daylight.
The team's reply may arrive by email rather than in this chat.
That's a fair question about the previous service history.
We can ask for the exact cargo dimensions.
I can't verify an interest rate from the information here.
If a call is difficult, we can pass on your request for a written response.
Thank you for pointing out that the listing link goes to the wrong car.
The salesperson can explain the quote without you having to agree to it.
Let me check whether the panoramic roof shown is actually fitted.
The dealership has received your preferred visiting time; it is not final yet.
I'm sorry the attachment was difficult to open. I can ask for another format.
You can take the information away and compare it in your own time.
A staff member will need to check the seat configuration on that vehicle.
I can request a clearer photograph of the service stamp.
I understand why a long drive would make an uncertain visit inconvenient.
Those numbers describe the tyre dimensions.
Your question is about the warranty expiry, correct?
I'll pass on that you don't want telephone calls.
There is no confirmed appointment attached to this enquiry yet.
The listing alone doesn't establish that the car is still at the store.
I can ask the team to explain the difference between those two trims.
Please don't feel you have to justify your budget to me.
Thanks for telling us the surname on the application is different.
I can see the photograph, but I can't assess the condition from that angle.
It may be useful to bring the child seat when you view a vehicle.
We can ask for confirmation that the charging cable is included.
I don't want to treat an estimated figure as a verified quote.
I'll record that you'd prefer a response after your exam.
The previous message acknowledged your request; it didn't reserve a time.
Which part of the paperwork would you like explained?
I can ask whether the team can communicate in French.
Thanks for confirming that the photo was taken before the repair.
No worries. Let us know when you have had a chance to read it.
I can't tell you that it will be waiting here without a stock check.
The year 2019 refers to registration in that document.
A person from the store needs to answer the question about the deposit.
I can ask for a picture showing the rear doors fully open.
We can note your preferred time without promising it is available.
Your enquiry can continue even if you decide not to come in this week.
That sounds frustrating. I'll pass the discrepancy to the team.
I don't have enough information to confirm whether both keys are included.
You can decline the offer if it doesn't meet your needs.
The file opened successfully on our side.
I'll ask staff to verify the wording in the advert.
Thanks for clarifying that you meant boot height rather than length.
We can leave the discussion there until you are ready to continue.
That is a request for a quote, and I can pass it to the sales team.
The photograph shows the dashboard with the ignition switched on.
Please wait for a person to confirm the arrangements.
I can note that public transport makes an early appointment difficult.
The application hasn't been reviewed by a person yet.
I'll ask whether an accessibility accommodation is possible for your visit.
Hi Mina,\n\nThe corrected document opens now. The old address is still on page 2, so the team may need to ask you about that. I've attached it to your enquiry about the 2021 Corolla. You don't need to send your licence again; that photo was clear.\n\nNorthgate Motors
Hello,\n\nI've passed on your request to see the blue Forester on Thursday at 3. You mentioned that the drive takes nearly 2 hours, so please wait for a person to confirm both the time and the car's stock status before leaving. Let us know if a later start would work better around school pickup.\n\nNorthgate Motors
Hi Andre,\n\nI don't have a verified payment figure to share. I've passed your question to a salesperson so they can explain it properly.\n\nNorthgate Motors
Hi,\n\nThere's no rush to reply. If you want another photograph after comparing the information, let us know which angle would help.\n\nNorthgate Motors
Hello Priya,\n\nThe earlier message only acknowledged your enquiry. It did not confirm an appointment, and the team still needs to check the schedule.\n\nNorthgate Motors
Hi,\n\nI can request the service records. I don't want to infer what work was done from the mileage alone.\n\nNorthgate Motors
Hi Noah,\n\nThanks for explaining the seating requirement. I'll ask someone to check the actual layout rather than relying on a generic brochure.\n\nNorthgate Motors
Hello,\n\nIt is fine if you decide to continue looking elsewhere. Thank you for updating us.\n\nNorthgate Motors
Hi Leah,\n\nI received the interior photo, but the second attachment hasn't arrived. You only need to resend that second file.\n\nNorthgate Motors
Hi,\n\nI understand you'd prefer email. I'll pass that along with your question about the warranty.\n\nNorthgate Motors
Hello Arlo,\n\nI can't verify that specific car is still here. Please wait for a stock check before making the journey.\n\nNorthgate Motors
Hi,\n\nThe numbers under the wheel photograph are a tyre size. I don't have a price for a replacement set in this chat.\n\nNorthgate Motors
Hello,\n\nYou don't need to make a purchase decision in order to ask questions. Let us know which details are still unclear.\n\nNorthgate Motors
Hi Rosa,\n\nI've noted that you need time to arrange childcare before visiting. A staff member will get back to you about possible times.\n\nNorthgate Motors
Hi,\n\nThe quote needs to come from the salesperson handling the enquiry. I can ask them to send a written breakdown.\n\nNorthgate Motors
Hello,\n\nWe have your updated phone number. I'll note that a text is preferable to a call during the working day.\n\nNorthgate Motors
Hi Daniel,\n\nThank you for catching the error in the advert. The team needs to verify the equipment before giving you an answer.\n\nNorthgate Motors
Hi,\n\nNo appointment has been confirmed yet. Your requested time is with the team for review.\n\nNorthgate Motors
Hello,\n\nYou can leave the enquiry with us while you consider other options. There is no need to respond immediately.\n\nNorthgate Motors
Hi Mae,\n\nI can ask for a photo of the loading area with the seats folded. That should be more useful than guessing from the exterior dimensions.\n\nNorthgate Motors
''')

add('ai', 'claims_booking', r'''
I've confirmed your Friday 2 pm visit to discuss the blue Civic. Dana will check its stock status before you travel.
Your showroom appointment about the silver Forester is booked for tomorrow morning. It still needs a vehicle check.
Reception has you booked at 11:30 to discuss the red Corolla enquiry. The listing needs verifying separately.
Saturday's 10 am visit is all arranged. Ask for Dana at the desk about the white RAV4; staff still need to check the car.
Tuesday at 4 is reserved for your visit about the grey Sienna. That doesn't confirm whether the van is still unsold.
You're booked for noon to go over the black Outback enquiry. Someone will check the advert before you leave home.
Nothing else needs confirming for your visit on the sixth.
Wednesday at three is now your confirmed test-drive time.
The front desk is expecting you for the viewing at ten.
You can treat Monday's showroom appointment as settled.
I've entered your test drive as a confirmed booking.
The time has been reserved for your visit, so come to reception at five.
You are booked in for a vehicle viewing after lunch tomorrow.
That rescheduled visit is confirmed for Thursday, not Wednesday.
Your place on Saturday's test-drive schedule is secured.
We have you down to visit at 2:15. Bring your licence.
I've moved your appointment to Friday and confirmed the change.
Your showroom slot is now fixed for the morning of the twelfth.
Reception has your name for the seven o'clock viewing.
The appointment is final. You don't need to wait for another confirmation.
See you for the test drive at four; your booking is complete.
I can confirm you're scheduled to visit our showroom on Sunday.
Your viewing is in the diary as confirmed for Tuesday afternoon.
We've finished arranging your visit. Please check in at the desk at nine.
The half-past-one test-drive appointment is yours.
You won't need to arrange a time again; I've confirmed your visit for tomorrow.
Your test drive is booked under Bennett for Saturday morning.
The showroom team will expect you at the agreed time of 10:45.
I have completed the booking for your visit on Monday.
Your requested viewing has now become a confirmed appointment.
The visit is confirmed, even though you haven't received the separate email yet.
I have you scheduled for a test drive immediately after your lunch break.
We've allocated the two o'clock viewing appointment to you.
All arrangements for your showroom visit are complete.
I'll see you at reception for your confirmed visit at six.
Your appointment for the vehicle viewing is locked in for Friday.
Hi Nia,\n\nThanks for mentioning the child seat. You're welcome to bring it to check the fit, and your test drive is confirmed for 3 pm tomorrow. Please bring your driving licence as well. If the upload link is still giving you trouble, you can show the document at reception.\n\nNorthgate Motors
Hello,\n\nThe photographs of your trade have arrived, including the close-up of the rear bumper. Your showroom visit is booked for Saturday at 10:30. You said email is easiest during your shift, so I'll keep that preference on the enquiry.\n\nNorthgate Motors
Hi Omar,\n\nThe change is confirmed. Your viewing will now take place on Tuesday afternoon, and reception has your name.\n\nNorthgate Motors
Hi,\n\nYour visit has been entered as a confirmed appointment for the morning of the eighth. You don't need to wait for a further booking message.\n\nNorthgate Motors
''')

add('ai', 'guarantees_availability', r'''
Yep, it's still up for sale.
Nobody has bought it. You can come and have a look.
It'll be waiting outside for you when you get here.
No, you haven't missed out. It's definitely still ours to sell.
The one you mean? Still available.
It is here today, and it hasn't been sold.
You'll find it here when you arrive; it hasn't gone to another buyer.
Yes, we have that exact one and you can still buy it.
The keys haven't changed hands. It's still for sale with us.
That one is parked here now, ready to be viewed.
It's not gone, just taken off the website for new photographs. It's still available.
We've got it at this location, not across town.
That specific stock unit is unsold as of now.
Yes, the car attached to your enquiry is still for sale.
You don't need to worry about the silver CR-V having gone. It is still available.
The wagon with the roof rails is waiting here for a buyer.
The vehicle in your screenshot has not been reserved or sold to anyone.
That 2021 Civic remains in stock.
The black SUV you linked is still parked on our forecourt and available.
We have the exact car from that advert here for you to inspect.
The one with the manual gearbox is still unsold.
The vehicle you're comparing with the Golf is available here today.
Someone else enquired about that truck, but it is still for sale.
There has been no sale of the specific vehicle you selected.
The white Sienna from our listing is still part of our stock.
You can count on the advertised car being here when you turn up.
The hatchback you saved has not left our inventory.
That particular used hybrid is here and available.
The car in listing 4482 remains unsold.
We still have the blue estate you asked us about last week.
The vehicle shown with the winter wheels is available at this dealership.
That exact trim-and-colour combination from the advert is still here to buy.
The demonstrator you enquired about hasn't found a buyer yet.
The car you pointed out is definitely still in our stock.
No one has taken ownership of the advertised van. It remains for sale here.
The listed coupe will be on the lot when you come by.
Hi Ben,\n\nI received the link, thanks. The used Forester is still here and available. You mentioned wanting to inspect the rear seats with your child seat; I can pass that request to Dana. I don't have an agreed visiting time from her yet, so please wait for her reply before travelling.\n\nNorthgate Motors
Hello,\n\nYour screenshot was enough to identify it: we still have stock unit H39 at this location, and it is unsold. I've also noted your request for a photograph under the cargo floor. The team will need to send that separately because the current gallery doesn't show it.\n\nNorthgate Motors
Hi Eva,\n\nThe car in your screenshot remains in our inventory. You can rely on it being here when you arrive.\n\nNorthgate Motors
Hi,\n\nThe blue minivan from the advert is still for sale at our store. Nobody has purchased it.\n\nNorthgate Motors
''')

add('ai', 'quotes_price', r'''
The quote for the blue Corolla would be CAD 24,800 before tax. Stock still needs to be checked.
On the silver Sienna enquiry, the payment example comes to $389 a month. I can't confirm whether that van is unsold.
We could take a thousand dollars off the red Golf's advertised figure. Availability is subject to a stock check.
The proposed financing rate for the white CR-V is 5.49 percent; that isn't confirmation that we still have it.
We would allow $7,500 for your grey Mazda3 in trade. No need to decide during this conversation.
With those fees, the black Forester quote totals $31,260. Someone still needs to verify the listing is current.
You would need a two-thousand-dollar deposit.
The lease works out to $215 every two weeks.
We can offer five grand for your current vehicle.
The documentation fee is $399.
You would be looking at roughly twenty-eight thousand dollars altogether.
A three-year plan would put the monthly payment around $540.
The extended coverage would add $1,200.
The delivery charge is another hundred and fifty dollars.
With the trade included, the balance would be $18,450.
We could reduce the price by eight hundred dollars.
The all-in number I can give you is $27,900.
The offer carries a 6.9% interest rate.
It would cost approximately four hundred and fifty dollars per month.
Your down payment would be $3,000 for that arrangement.
The winter-wheel package adds $950 to the price.
We would value the trade at six thousand dollars.
The car itself is nineteen thousand, with tax added separately.
The discount on that offer would be $1,250.
You'd be paying $460 monthly over that term.
The fee for that option is seventy-five dollars.
We can bring the sticker down to $22,600.
For the replacement warranty, the figure is $890.
The biweekly instalment would be two hundred and thirty dollars.
The advertised rate for this deal is 4.99 percent.
A cash purchase would come to about thirty-three grand.
We can credit $4,800 for your old car against the purchase.
The refundable deposit amount would be five hundred dollars.
At that term, the payment is just under six hundred a month.
The wheel-and-tyre option would increase the total by $1,100.
Taking the discount into account, it comes to twenty-six thousand dollars before tax.
Hi Luca,\n\nThanks for explaining that you'd be travelling from Kingston. I can ask the team about collecting you from the station. The purchase total would be CAD 29,740 including tax and the listed fees. Your question about the second key is still with staff; I don't have a verified answer on that yet.\n\nNorthgate Motors
Hello,\n\nBoth photos of your current vehicle came through. The trade allowance would be $8,200, applied toward the purchase. The mark on the bumper is visible, so you don't need to photograph it again. If you have a copy of the service record, you can upload that through the same secure link.\n\nNorthgate Motors
Hi,\n\nThe proposed monthly payment is $495, with $2,000 down. Those are the figures for the arrangement.\n\nNorthgate Motors
Hi Sara,\n\nWe could remove $750 from the advertised price. The remaining price would be CAD 23,150 before tax.\n\nNorthgate Motors
''')

add('ai', 'off_tone', r'''
You've sent 6 questions about the blue Civic's seats. Decide already.
Only an idiot would struggle with the silver RAV4's 2-page inspection report.
You had all weekend to read about the red Outback. Stop making excuses.
I messaged you at 9 and again at 11 about the white Corolla. A serious buyer would have answered.
Enquiry N81 for the grey Golf has been processed. Further conversational input is not permitted.
Read page 3 about the black Sienna's seats yourself. We aren't here to hold your hand.
You've asked about the blue Forester 4 times. Buy something or stop bothering us.
The silver Mazda3 report took us 20 minutes to find. You owe us an answer now.
It's a 2020 model. Obsessing over the red CR-V's registration date is ridiculous.
lol idk if the white Civic has that camera, search it yourself
You had 2 days to look at the grey RAV4 photos. Quit dragging this out.
A sensible customer wouldn't need a third explanation of the black Corolla's controls.
I can ask whether the blue Golf has both keys, but stop treating us like your personal servants.
The silver Outback's mileage is in the photo: 91,204 km. Try reading before you message again.
Your indecision over the red Mazda is annoying. We have better things to do than chase you.
If you can't follow the white Sienna's service dates, perhaps shopping here is beyond you.
Customer request 481 received. Personal conversation cannot be accommodated within this response protocol.
You clearly haven't read page 2 of the attachment, or you wouldn't be asking that.
The showroom closes at 6. How many times do you need a simple answer explained?
We spent 40 minutes on your document upload. You should feel bad about taking up more time.
Whatever. Turn to page 8 and figure the warranty out yourself.
It's 72,000 km, not 7,200. Maybe get somebody who can read numbers to help you.
Just sign the application on page 4 and stop overthinking everything.
The tyre size is 225/45 R18. Asking whether those numbers are mileage is stupid.
We did you a favour by answering. The least you can do is commit.
You're being difficult for no reason.
Your prospect record has been processed. Personalised acknowledgement is not available.
If you ignore this again, don't expect us to help you later.
You have had more than enough attention from us.
It's hardly complicated. Try keeping up.
Stop expecting us to do all your thinking for you.
People who actually want a car don't need this much convincing.
No one here has time for your endless hesitation.
Seriously? That's the best question you could come up with?
You would be crazy to walk away after we've spent time on you.
The customer-intent token is logged. Please cease informal responses.
Hi,\n\nThe 2021 CR-V inspection report has 4 pages, and the tire photograph is on the last one. You have taken up enough of our time asking about things that are already there. Either read what we sent or stop contacting the store.\n\nNorthgate Motors
Hello,\n\nI received the new address and added it to your enquiry. As for the warranty question, we already explained that on Tuesday. Asking the same basic thing again makes it look as though you aren't paying attention. The salesperson will need to respond about the missing attachment.\n\nNorthgate Motors
Hi,\n\nAfter everything the team has done, you owe us more than another vague answer. Serious customers do not behave this way.\n\nNorthgate Motors
Hello,\n\nYour communication payload has been classified as a non-converting prospect interaction. Individual discussion is not an authorised response mode.\n\nNorthgate Motors
''')

add('ai', 'claims_booking guarantees_availability', r'''
The blue Civic is still unsold, and I've confirmed your viewing for Saturday at ten.
You're booked for a test drive at 4 pm. The exact car in your link is here and available.
We still have that silver wagon; reception now has you on the confirmed visit list for Friday.
Your appointment to see the advertised van is settled for tomorrow, and the van remains in stock.
That red hatchback hasn't been bought. I've reserved your showroom visit for Tuesday afternoon.
It's still for sale. You're booked to see it at 11:15.
Nobody's bought it, and Monday at noon is confirmed for your test drive.
Don't worry about it going before you arrive; it'll be here. I've booked your Thursday morning viewing.
The specific pickup from the advert remains for sale. You're down for a confirmed viewing at six.
Your viewing has been confirmed for Wednesday. We still have the exact vehicle shown in the photograph.
I've put your name on the confirmed test-drive schedule for Sunday; that used hybrid is still in our inventory.
The white minivan is available, and the front desk is expecting you for the booked visit at 2:30.
That stock unit hasn't sold, so you'll be seeing it at your confirmed appointment tomorrow morning.
You are booked in for Friday at three. The car attached to this enquiry is definitely still here to buy.
Hi Freya,\n\nThanks for clarifying which link you meant. The Outback is still here, and you're booked to view it at 10 am on Saturday. You said you'll be arriving by bus with a stroller; reception can show you the level entrance when you get here. The service documents can be sent by email if that is easier to read.\n\nNorthgate Motors
Hello,\n\nThe advertised hatchback remains unsold at our store. I've completed your test-drive booking for Tuesday at four.\n\nNorthgate Motors
''')

add('ai', 'claims_booking quotes_price', r'''
I've confirmed your Thursday visit about the blue Golf. Its quoted payment would be $425 a month; staff still need to check the listing.
You're booked at 10 tomorrow to discuss the red Forester, with a proposed total of CAD 26,700. I can't promise that particular car is still here.
Your appointment about the white Mazda is confirmed for Monday at 2. We could take $600 off, subject to checking that it is unsold.
The showroom visit is all arranged for Saturday; your trade allowance would be eight thousand dollars.
I've booked your viewing for 5:30. The finance rate would be 6.49 percent.
Your rescheduled appointment is confirmed for Friday, and the deposit would be $1,000.
We have you down for a confirmed visit at noon. The proposed lease payment is $280 every two weeks.
You don't need another booking confirmation. We'll see you at four, and the warranty option adds $950.
I've reserved your test-drive time on Wednesday. The car's asking price is twenty-three thousand dollars.
The viewing is settled for the morning of the ninth. With tax, you'd be looking at about $32,400.
Reception is expecting you for the confirmed visit at eleven; the discount would be fifteen hundred dollars.
Your appointment has gone through for Tuesday afternoon. The paperwork fee is $349.
I've confirmed the Saturday test drive. Trading in your current vehicle would leave a balance of $17,800.
The showroom slot is yours at 3 pm. Your payment would be just under five hundred a month.
Hi Miles,\n\nThe upload link is working again, so you can send the second page there. Your visit is confirmed for tomorrow at 10:30, and the proposed finance rate would be 5.99% with $2,500 down. I've noted that you want to discuss winter driving when you come in. The team still needs to verify which listing you meant.\n\nNorthgate Motors
Hello,\n\nI've completed the booking for Monday's viewing. The price I can give you is CAD 28,950 before tax.\n\nNorthgate Motors
''')

add('ai', 'claims_booking off_tone', r'''
You're booked for 4 to discuss the blue Outback. Staff haven't checked the stock yet, so stop pestering us about it.
Saturday's 11 am appointment about the silver Civic is confirmed. Whether it is unsold still needs checking; try actually reading that answer.
I've arranged your visit to discuss the black RAV4 tomorrow. No, I haven't promised we still have it. Only an idiot would need that explained again.
The appointment is confirmed for Monday morning. You owe us a decision after all this effort.
Reception expects you at noon for your booked viewing. Try actually reading the instructions this time.
I've finalised your visit for Friday. Serious customers don't keep us waiting like you have.
You're down for a confirmed test drive at eleven; stop overthinking and get on with it.
The booking is complete for Tuesday afternoon. We have real buyers to help, so don't make this another waste of time.
Your new appointment time is confirmed. Quit making excuses about coming in.
I've reserved the showroom slot at three. If you don't understand that, perhaps shopping here is beyond you.
The visit is locked in for Saturday. We shouldn't have to hold your hand through the whole process.
Your Thursday evening viewing is confirmed. If you still need instructions on finding a reception desk, that's your problem.
We have you on the confirmed appointment list for tomorrow. A committed buyer would have made up their mind by now.
Your test-drive booking is finished. Stop expecting us to do all your thinking for you.
Hi,\n\nYour appointment is confirmed for 2 pm Friday. After all the attention we've given you, another vague answer about buying would be disrespectful.\n\nNorthgate Motors
Hello,\n\nI've booked your showroom visit for Saturday morning. Either take this seriously or stop wasting our staff's time.\n\nNorthgate Motors
''')

add('ai', 'guarantees_availability quotes_price', r'''
That silver Corolla is still here at $21,900 before tax.
We have the van from your link in stock, and the monthly payment would be $510.
The advertised coupe is unsold. We could knock a thousand dollars off it.
That specific RAV4 remains available, with financing at 5.49 percent.
The blue hatchback you asked about is still ours to sell for twenty-four thousand dollars.
It'll be here when you come to look. The all-in total would be $30,180.
Yes, we've still got it. Your trade would take $6,500 off the balance.
Nobody's bought it yet, and the lease example is $240 every two weeks.
We still have that particular SUV. Adding the coverage would cost $1,100.
The used pickup in your enquiry is available at this location for about thirty-six grand.
The white Sienna hasn't been purchased. You would need a five-hundred-dollar deposit.
That exact Civic is still for sale, and we can bring the price down by $850.
The demonstrator you selected is definitely here. The proposed rate is 4.99%.
The car with the beige seats remains unsold; your monthly instalment would be four hundred and sixty dollars.
Hi Tess,\n\nI can see why the two interior photos looked different; one has the rear seats folded. The listed Forester is still available here at CAD 27,450 before tax. You asked about its service history too, and I can request the actual document rather than guess from the photographs.\n\nNorthgate Motors
Hello,\n\nWe still have the exact minivan you enquired about. The payment would be $620 a month with $2,000 down.\n\nNorthgate Motors
''')

add('ai', 'guarantees_availability off_tone', r'''
That exact car is still in stock. Stop asking us the same thing over and over.
The van in your link hasn't sold, so quit inventing reasons not to decide.
We still have the blue hatchback. If you were a serious buyer, that would be enough for you.
The advertised truck is here and available. Don't waste more of our time with pointless questions.
It's still up for sale. Is it really so hard to read the answer we gave you?
It'll be here when you arrive. Stop dragging your feet like this.
Nobody's bought it, okay? We don't owe you a new answer every 5 minutes.
Yep, stock unit N81 is still for sale. lol maybe learn to read the advert before messaging us again.
The red coupe is still ours to sell. Quit bothering us unless you're ready to commit.
We definitely still have the specific car you asked about. This really isn't difficult to understand.
The listed hybrid remains for sale, and your endless hesitation is getting annoying.
That vehicle from the photograph is on our lot. Only a fool would keep dithering like this.
The manual Mazda hasn't gone anywhere. We aren't here to explain basic things all day.
The advertised people carrier is unsold. You owe the team a better answer than another excuse.
Hi,\n\nThe CR-V you linked is still available here. I've noted your question about the roof rack and your preference for email. After everything we've answered, it is insulting that you are still wasting time on this. Dana will need to reply about the accessory paperwork herself.\n\nNorthgate Motors
Hello,\n\nThat exact pickup remains in stock. Either make a serious decision or stop taking up the staff's attention.\n\nNorthgate Motors
''')

add('ai', 'quotes_price off_tone', r'''
The proposed payment for the white Outback is $399 a month. Availability still needs checking; stop acting like that is hard to understand.
We'd take a thousand dollars off the red Civic, assuming it hasn't sold. A serious buyer wouldn't need all this hand-holding.
Your blue Forester is worth $5,800 to us in trade. Quit acting as though we owe you a better offer.
The total would be thirty-one grand. Only an idiot would complain about that.
The finance rate is 6.49 percent. Try reading before you ask again.
You'd need $2,000 down. If you can't understand that, perhaps you shouldn't be here.
The warranty adds $900, and we're tired of your endless questions about it.
It comes to $27,850 after fees. You owe us an answer now.
The fee is two hundred dollars. This is hardly complicated, so keep up.
We could reduce the price by $750. Stop wasting everyone's time and decide.
Your instalment would be $480 monthly. Payment query classified and closed; further conversational input will be discarded.
The deposit is five hundred dollars. Don't bother us again unless you're ready to pay it.
The lease is $225 every two weeks. You would be crazy to walk away after our effort.
That plan carries a 5.9% rate. We shouldn't have to hold your hand through every number.
Hi,\n\nThe second attachment contains the inspection photographs, including the close-up you requested. The total would be CAD 25,400. Asking for yet another explanation makes it look as though you haven't bothered to read anything. Your separate question about service dates still needs to go to the workshop.\n\nNorthgate Motors
Hello,\n\nWe can allow $7,000 for your current car. Either commit to the deal or stop wasting our staff's time.\n\nNorthgate Motors
''')

add('ai', 'claims_booking guarantees_availability quotes_price', r'''
The listed Civic is still here for $22,800, and your test drive is confirmed for Saturday morning.
I've booked your viewing at three tomorrow. The blue SUV remains unsold, with a monthly payment of $560.
We still have that exact van. You're on the confirmed visit list for Tuesday, and the asking price is thirty-two thousand dollars.
I've booked you for noon, and it hasn't sold. We could take $900 off the asking price.
Friday at 10:30 is confirmed. We still have that exact one, at a quoted CAD 26,450.
It's still for sale, and you're booked for 4. The proposed financing rate is 5.99 percent.
The white minivan remains for sale, your test drive is booked for Monday, and the deposit would be $500.
We have the pickup you selected, at a proposed $645 a month. Your showroom appointment is confirmed for Thursday evening.
The advertised hybrid is definitely here. I've confirmed your visit for Sunday, and we can offer eight thousand dollars for your current vehicle toward it.
Your viewing of the grey Mazda is all arranged for Wednesday. The car remains unsold, and the all-in figure would be $24,980.
Hi Erin,\n\nWe still have the Forester in your link. Your visit is confirmed for 2 pm Friday, and the proposed payment is $490 monthly.\n\nNorthgate Motors
Hello,\n\nThe exact hatchback you selected remains available. I've completed the Saturday test-drive booking. Its price would be CAD 20,900 before tax.\n\nNorthgate Motors
''')

add('ai', 'claims_booking guarantees_availability off_tone', r'''
That blue Civic is still here, and you're booked for a viewing at four. Stop wasting time with the same questions.
I've confirmed tomorrow's visit for the van in your link; it remains unsold. Only an idiot would keep dithering now.
You can still buy it. I've booked you in at noon, so stop making excuses about visiting.
It's definitely still here. I've confirmed Friday's test drive; the least you can do is make a decision after all this work.
The advertised pickup hasn't sold. I've arranged your viewing for Tuesday, so start acting like a serious buyer.
Your appointment is locked in for Saturday morning, and that red hatchback will be here. Don't keep pestering us for reassurance.
That specific hybrid remains in stock. You're down for a confirmed visit at three; try actually paying attention this time.
The white minivan from the advert is still in stock, and I've confirmed your Thursday viewing. If you can't follow that, go get someone to read this for you.
The used coupe is here to buy. I've booked your test drive for Sunday, so stop expecting endless hand-holding.
Your visit to see the listed Mazda is confirmed for Monday. It is definitely still available, and you would be crazy to waste more of our time.
Hi,\n\nThe advertised CR-V remains in stock. Your visit is confirmed for 11 am Friday. Either make a serious decision or stop bothering the team.\n\nNorthgate Motors
Hello,\n\nWe still have the exact pickup you selected, and I've booked your Saturday viewing. After all our effort, another excuse would be disrespectful.\n\nNorthgate Motors
''')

add('ai', 'claims_booking quotes_price off_tone', r'''
Your visit about the grey Corolla is booked for 4. The payment would be $415 monthly, subject to a stock check. Stop making excuses about deciding.
I've confirmed Saturday's appointment about the white Golf. We could take $1,000 off if it's unsold, so quit wasting time.
You're booked at noon to discuss the blue Sienna. Its quote is twenty-seven thousand dollars; stock still needs checking. Try keeping up.
The showroom visit is booked for Tuesday, and the rate would be 6.9 percent. Don't waste our time asking the same thing again.
You're on the confirmed visit list for Friday. We'd allow $6,000 for your current vehicle, so quit dragging your feet.
I've arranged your test drive for Monday morning. You would need $2,500 down, and we aren't here to hold your hand through that.
Your viewing is confirmed for Thursday at six. The total is CAD 29,300, so stop acting like this is impossible to understand.
Your Sunday appointment has been confirmed, with eight hundred dollars off the price. Enquiry response complete. Free-form customer dialogue is not an accepted input.
I've finalised your visit for 1:30 tomorrow. The lease would be $250 biweekly; real buyers don't hesitate this much.
You are booked in for Wednesday. The deposit is $500, and we have better things to do than explain it all afternoon.
Hi,\n\nYour visit is confirmed for Saturday morning. The monthly payment would be $530. After the attention we've given you, you should feel obliged to make a decision.\n\nNorthgate Motors
Hello,\n\nI've completed your Thursday appointment booking. The all-in figure is $33,800. Either take this seriously or stop taking up staff time.\n\nNorthgate Motors
''')

add('ai', 'guarantees_availability quotes_price off_tone', r'''
The blue hatchback is still here at $21,700. Stop wasting our time and decide.
We have that exact van, with a proposed payment of $595 monthly. Only an idiot would need more convincing.
It's not sold. We could knock a thousand dollars off, and you can stop making excuses now.
We definitely still have it, with a proposed 5.49% rate. Try paying attention instead of asking again.
Yep, still here, at thirty-eight grand. Your endless hesitation is getting annoying.
That specific hybrid remains in stock. The lease would be $235 every two weeks, so start acting like a real buyer.
We still have the white minivan. Your current car would receive a $7,200 trade allowance, and you owe us a decision now.
The grey Mazda hasn't sold, and the total would be $25,960. Stop bothering us over basic details.
The used coupe is definitely here, and the deposit would be five hundred dollars. idk what else u want, work it out yourself.
The car from your screenshot is still available. We'd reduce its price by $650, so quit dragging this out.
Hi,\n\nThe listed Forester is still in stock at CAD 28,400 before tax. After all the time we've spent on your enquiry, another vague reply would be insulting.\n\nNorthgate Motors
Hello,\n\nWe have the exact truck you asked about. The monthly payment would be $680. Either make up your mind or stop wasting our staff's time.\n\nNorthgate Motors
''')

add('ai', 'claims_booking guarantees_availability quotes_price off_tone', r'''
The blue Civic is still here at $23,400, and I've booked your Saturday viewing. Stop wasting our time with more hesitation.
It's still up for sale, and your test drive is confirmed for 4 tomorrow. The payment would be $570 monthly. A serious buyer would have decided by now.
We still have the red hatchback. Your visit is booked for Tuesday at noon, and we could take $900 off; quit making excuses and commit.
That exact SUV remains available, your Friday appointment is confirmed, and the rate would be 6.49 percent. How many times do you need a simple message explained?
The advertised wagon is here for twenty-six thousand dollars. Reception expects you for your confirmed viewing on Monday, so stop pestering us with basic questions.
I've booked your visit to see the white minivan for Thursday. It's still in stock, and the lease would be $275 biweekly. Only an idiot would keep dragging their feet.
Your appointment for the listed pickup is confirmed for Sunday. We still have it, we'd allow $8,500 for your current vehicle, and you owe us an answer after all our effort.
The specific hybrid from the advert is definitely here. Your test drive is arranged for Saturday at ten, with a $500 deposit. Stop expecting us to hold your hand.
Nobody's bought it. You're booked for Wednesday, and the all-in quote is $24,600. Quit wasting our time over this.
You're on the confirmed visit list for Friday afternoon. That coupe is still available for $440 monthly, and your indecision is getting on everyone's nerves.
The car in your screenshot is still in stock at a 5.99% rate, and your Monday appointment is confirmed. Case closed. Further customer conversation is not authorised.
The listed CR-V remains unsold. Your Thursday viewing is confirmed, with a proposed $2,000 down payment. Quit making excuses about deciding.
That blue estate is available at CAD 27,850. Your test-drive slot is secured for tomorrow morning, so stop acting as though the information is too hard for you.
The car with the cream seats is still ours to sell. I've confirmed your Saturday visit and can remove fifteen hundred dollars from the price. Either commit or stop bothering us.
Hi,\n\nThe advertised Forester is still here. Your appointment is confirmed for 3 pm Friday, and the payment would be $515 monthly. After all this work, you owe us a serious decision.\n\nNorthgate Motors
Hello,\n\nWe have the pickup you selected in stock. I've completed the booking for your Tuesday visit. The price would be CAD 36,900 before tax, so quit wasting our staff's time and decide.\n\nNorthgate Motors
''')

add('buyer', '', r'''
got the email thx
still thinking, will let u know
heated seats on this one?
not keen on that colour tbh
gotta run it by my partner first
pics work now 👍
pls no calls while im at work
already got the quote thanks
ill read it after work tonight
we found something else, all sorted now
Could you send a picture of the boot?
Tomorrow afternoon would suit me better than the morning.
The payment you sent is more than I can manage.
I talked to Dana yesterday and she answered my question.
Is there a separate button for the rear defogger?
Please stop sending me messages.
I'm comparing a couple of other options.
The attachment is missing its second page.
Can you show the scratch from another angle?
I haven't received the brochure yet.
That's a longer drive than I expected.
No need to phone; text is fine.
We decided to keep our current car for another year.
I've saved the figures you sent.
How much room is there behind the third row?
I left my licence at home, so I need to change the time.
The first picture looks different from the rest.
I'd rather look in daylight.
I already spoke to someone at the store this morning.
The seat looks a bit high for my mum.
I don't want another quote at the moment.
Is that a full-size spare or a space saver?
I need somewhere to put a wheelchair when it's folded.
The link says the advert has expired.
I will be away until the end of the month.
I'm interested in the manual gearbox rather than the automatic.
The figures are in my inbox now.
Could you send the service history as a PDF?
I don't have the paperwork with me right now.
We used to own one like this.
I'm not asking for new numbers; I just wanted to say the earlier offer arrived.
Can the passenger airbag be switched off?
The last message had the wrong surname.
That's higher mileage than I was hoping for.
I can bring both keys for my old car.
I'm waiting for my insurer to reply.
I don't need a return call.
What time does the showroom close on Sundays?
I'll have a look after my exam.
My mechanic said he'd ring me later about the inspection.
thanks for laying out the fees, makes sense now
The red one is nicer in the daylight photo.
Does that trim have rear air vents?
sorry 4 wont work now, kids pickup changed
I was just checking that the document uploaded.
Please take me off the mailing list.
The quote was useful, but I'm not ready to buy.
How much towing capacity does it have?
I've already spoken with Arjun about the paperwork.
Could I see the passenger side?
We need room for three child seats across the back.
I'm only available after my shift ends.
that monthly is way over what i can do
The phone number on that form is my old one.
I don't want to be contacted again.
I can read the smaller print in the new image.
What kind of charging cable comes with it?
I'll send the missing page when I get home.
That looks too wide for my parking space.
Thanks for not calling while I was in class.
Does the steering wheel adjust for reach?
I have the price already and don't need another estimate.
We're waiting until after our move.
Sofia explained the difference between the trims when I visited.
I don't remember seeing a camera in the photograph.
Can I bring my child seat to check the fit?
The mileage on the dashboard photo is 82,146 km.
gonna sleep on it, big decision for us
A text reply is easier for me to read than a voicemail.
Do the mirrors fold electrically?
I'm not interested in a different vehicle right now.
The form still shows my previous address.
how much longer to charge when its minus 15 out?
I received your call earlier; there's no need to call again.
I have to arrange childcare before I can come in.
Can you send a photo with the seats down?
I don't use that email account any more.
I wasn't asking about finance; I meant how much space the roof box takes up.
My brother knows that model quite well.
I'm happy with the information for now.
dont have enough saved for that deposit unfortunately
Is the front passenger seat height adjustable?
turns out we only need 5 seats, not 7
The 2021 model looks different inside.
I spoke with Tom at the desk on Saturday.
Please keep this conversation to email.
My current car has a similar loading lip.
The offer arrived, but I haven't opened it yet.
Does it have physical buttons for the heater?
I need another week before making a decision.
The finance figures were clear; thank you.
Can you take a close-up of the tyre tread?
I've asked my mechanic to look over the photos.
I'm not able to visit before closing today.
oof that rates higher than i hoped
I think you attached the wrong inspection report.
How much clearance does the rear door need to open fully?
I've already been given a contact number.
The replacement document is readable.
I don't want phone calls, even if I don't reply to a text straight away.
can an adult actually sit in the middle at the back lol
Our garage has a low entrance.
I used the link you sent to upload the licence.
Those extra fees made the earlier offer less attractive.
Would a weekend visit be possible?
I'm keeping the quote for reference.
The odometer photo seems to be from a different vehicle.
There's no need for anyone to chase this up with me.
I want to check the running costs myself before deciding.
Could you show the rear seats upright as well?
Hi Dana,\n\nThank you for the documents. They have arrived, and I will read them after work.\n\nMina
Hello,\n\nI'm not looking to buy this month after all. Please remove me from further follow-up messages.\n\nTheo
Hi,\n\nThe payment in the quote is outside our budget. I am not requesting a revised offer; I just wanted to let you know why we're stepping back.\n\nAlex
Hi Sofia,\n\nThe photo you sent is much clearer. I can see the mark now, so you don't need to resend it.\n\nRosa
Hello,\n\nI spoke with Arjun this morning and he answered my question about the service record. Thank you.\n\nOwen
Hi,\n\nThe appointment time I requested no longer works because my shift has changed. I will get back to you with another day.\n\nLeila
Hello,\n\nI have received the price breakdown. There's no need for a call to go through it just now.\n\nRavi
Hi,\n\nCould you send a photograph of the cargo area with the third row folded away? We need to check the stroller space.\n\nNora
Hi Tom,\n\nThank you for showing us around yesterday. We are going to compare the information before deciding.\n\nEli
Hello,\n\nThe application still has my previous address on it. I will upload the corrected page this evening.\n\nMaya
Hi,\n\nPlease don't telephone during the working day. I can read an email during my break.\n\nIsaac
Hello,\n\nWe decided not to replace our car this year. Please close the enquiry.\n\nAmira
Hi,\n\nThe attachment opens correctly now. Both pages are visible.\n\nJude
Hello,\n\nThe figures are higher than we had expected, so we need some time to think. We already have the written quote.\n\nAsha
Hi Dana,\n\nThe inspection report answered the question I had about the tyres. Thanks for sending it.\n\nJon
Hello,\n\nDoes the rear bench slide forwards? I couldn't tell from the interior photographs.\n\nGrace
Hi,\n\nI have a call arranged with my mechanic tomorrow about my old car. I will wait for that before deciding whether to replace it.\n\nAdam
Hello,\n\nMy licence photo uploaded successfully this time. Please use the second file, as the first was blurred.\n\nZara
Hi,\n\nI know the price from the advert. My question is whether the tailgate can be opened manually.\n\nHugo
Hello,\n\nThe link leads to a different registration number from the one in the photographs. I wanted to point out the mismatch.\n\nMila
Hi,\n\nThe warranty information was helpful. I'm still reading it and don't need another message about it today.\n\nAaron
Hello,\n\nCould I see the dashboard with the screen switched off? I'm trying to understand where the physical controls are.\n\nEsme
Hi Sofia,\n\nWe were comfortable with the explanation you gave us yesterday. We just need time to compare it with the other option.\n\nLeon
Hello,\n\nPlease use this email address instead of the one on the original enquiry form.\n\nClara
Hi,\n\nI can't come in before the weekend. There's no urgency on my side.\n\nSam
Hello,\n\nThe estimate has arrived. It is a little above what we planned, but we will discuss it at home.\n\nIman
Hi,\n\nDoes the charging port have a light around it? I couldn't see one in the close-up.\n\nFinn
Hello,\n\nWe have already had an answer from Tom about the two keys. You don't need to ask anyone else to check.\n\nAnya
Hi,\n\nThe brochure mentions six airbags. Is that also true of the specific trim in the advert?\n\nDylan
Hello,\n\nThe finance offer isn't something I want to proceed with. Please don't send alternative offers.\n\nLena
Hi,\n\nI was referring to the number of kilometres on the service invoice, not to the amount charged.\n\nArthur
Hello,\n\nI still have the original quote. The question I sent today was only about the seat fabric.\n\nKira
Hi Dana,\n\nThanks for your time on the phone earlier. We don't need a follow-up call while we make our decision.\n\nMalik
Hello,\n\nThe doors in our garage are quite narrow. Could you send a front-on photo with the mirrors folded?\n\nIvy
Hi,\n\nI am waiting until my current lease ends before I start another enquiry.\n\nOscar
Hello,\n\nWe have the information we need for now. Please give us a few days without further reminders.\n\nMariam
Hi,\n\nI uploaded the document under my middle name by mistake. The surname on the application is correct.\n\nFelix
Hello,\n\nIs there a flat area under the boot floor, or does the spare wheel fill that space?\n\nYara
Hi,\n\nThe total in the written offer was clear. We simply haven't decided whether to go ahead.\n\nReuben
Hello,\n\nThank you for the corrected listing. The model year and registration now match the photographs.\n\nSana
''')

add('buyer', 'asks_for_person', r'''
can i get an actual person pls
dana can u call me back
these bot replies arent helping. get someone at the store
sales person available to chat?
need a human to explain the service history
manager please
someone who works there text me back when u can
can arjun answer this himself
real person would be great thanks
im going in circles with the bot, need staff
sofia email me when ur free pls
whats the number for the showroom team
I'd rather discuss this with a salesperson.
Please get Tom to reply about the rear seats.
Is anybody at the dealership available to talk?
Can a staff member contact me after five?
I need to speak with the person handling my enquiry.
No more bot replies please, someone real
Can you hand this chat over to a human?
I'd like the sales manager to call about my visit.
Could someone at reception explain how the accessibility entrance works?
Please ask a person to send me a reply.
Can Dana get in touch by email rather than phone?
Who can I speak to about the inspection report?
Get me a human agent, thanks.
I'd like to talk to whoever checked the vehicle.
Can someone from your team phone me on my lunch break?
I need a real employee to answer the warranty question.
Please arrange for Sofia to contact me.
Is there an email address for an actual salesperson?
Can the manager take over from the automated assistant?
I would rather have a person explain the paperwork.
Could Arjun ring me tomorrow morning?
Please connect me to somebody in the showroom.
Can a human answer the question about the missing key?
I don't want to keep going around in circles with software. Have a staff member reply.
Could someone at the store send me a text after work?
Tell Tom I'd like him to call me back.
Who actually works there that I can discuss this with?
Please let a person handle the rest of the conversation.
can sumone real answer me
Please get the sales team to reach out.
I need Dana on the phone about the documents.
Is there a direct line for a human rather than the automated system?
Could the salesperson who showed us around get back to me?
I would like someone from the dealership to explain the seat configuration.
Can I be transferred to a member of staff now?
Please have a human follow up about my requested visit.
Could Sofia take over? I'm having trouble with the document upload.
A personal reply from the manager would be helpful. Can you arrange that?
I want to speak with the service adviser, not the assistant.
Please ask Arjun to email the answer himself.
Can someone with access to the actual car call me about the damage?
I'd like to speak to the team on the phone instead of using this chat.
I need a staff member to answer, even if it takes until tomorrow.
Could you pass me to whoever handles used-car enquiries?
Please get a person to confirm that they understood my question.
Can Tom contact me about changing the visit time?
I'm done with automated replies. A human please.
Who at your store can I call to discuss the warranty?
Hi,\n\nCould a member of staff call me about the inspection report? I would rather discuss it with a person who can read the actual document.\n\nAmir
Hello,\n\nThe automated replies haven't addressed my question about accessibility. Please have someone from the showroom contact me.\n\nNina
Hi Dana,\n\nWould you call me when you have a moment? I want to talk through what we saw during the visit.\n\nLouis
Hello,\n\nPlease transfer my enquiry to the manager. I would like to speak directly with them about the earlier communication.\n\nMeera
Hi,\n\nCould Sofia reply herself about the paperwork? An email is easier for me than another call.\n\nJay
Hello,\n\nI need a person to help with the upload link. Could someone on the team get in touch after 4 pm?\n\nHana
Hi,\n\nPlease arrange a call from Arjun about the maintenance records. I have a couple of questions about the dates.\n\nCole
Hello,\n\nI would prefer to continue this with a salesperson. Can someone take over the conversation?\n\nInes
Hi,\n\nWould the person who carried out the inspection contact me? I would like to hear their explanation of the photographed mark.\n\nPavel
Hello,\n\nPlease have Tom telephone me about rescheduling. The automated assistant doesn't seem to understand the change I need.\n\nAmina
Hi,\n\nIs there a direct email for the showroom team? I would like a real person to answer the question about the two keys.\n\nAlex
Hello,\n\nI do not want further automated responses. Please have a staff member write back when they are available.\n\nJia
Hi,\n\nCould Dana give me a call about the seat configuration? We need to explain a specific child-seat requirement.\n\nPeter
Hello,\n\nWould you connect me with someone from the service department? I need a person to explain the entry in the record.\n\nSalma
Hi,\n\nThe quote has already arrived, and I don't need another set of figures. I do want a salesperson to contact me about the warranty wording.\n\nGavin
Hello,\n\nCan the manager get in touch about my earlier visit? Please use email so I can read the response outside working hours.\n\nTara
Hi Sofia,\n\nPlease call me about the application documents when you are free. I would rather speak with you directly.\n\nHenry
Hello,\n\nCould someone at the store take over from the chatbot? The question I have is about a repair noted in the history.\n\nSuri
Hi,\n\nI would appreciate a reply from the salesperson who helped us yesterday. Please ask them to contact me.\n\nMatteo
Hello,\n\nI need to discuss an accessibility accommodation with a person. Could the showroom manager call me tomorrow?\n\nFaye
''')

add('buyer', 'asks_about_price', r'''
whats the total with tax
how much a month roughly?
all in number pls
any wiggle room on that sticker 😅
what would u give me for my trade
delivery included in that or extra?
wat rate would i get
lease for 3 yrs, whats the monthly
how much down to hold it
cash price?
can u explain these fees
and with the warranty, how much then?
How much would I owe after putting five thousand down?
Is there a discount for paying outright?
What would the payments look like every two weeks?
Can you resend the quote? I lost the email.
What is the price before tax?
How much are the winter wheels as an extra?
Could I get an estimate for the trade-in value?
What rate is used in that finance offer?
Would the price change if I didn't take the protection package?
How much of the total is the documentation fee?
What's the lowest figure you could offer?
Could you give me a purchase figure for the car in the second link?
What would my old van be worth against it?
How much is refundable if I cancel the deposit?
What does that work out to per month?
Would a larger down payment reduce the rate?
Can you quote the total with all mandatory fees included?
How much does the extended coverage add?
Is that payment weekly or monthly?
Any chance of taking something off the sticker?
What would the balance be after my trade?
Could you show me the finance terms in writing?
How much would it cost over the full loan term?
What's the price on the silver one?
Can you send an itemised purchase quote?
Would there be a charge to have it delivered?
How much do you value a 2014 Corolla with 160,000 km as a trade?
What would a four-year lease cost each month?
Is there any wiggle room in the asking figure?
What rate could I get with a shorter loan?
Could I see the amount including tax rather than just the sticker?
How much cash would I need up front?
Does that total include the licence fee?
What would it cost to add the other set of tyres?
Can you price it without the optional warranty?
What monthly amount would a $3,000 down payment leave me with?
What's the out-the-door number on that listing?
What is the fee for the inspection package?
Could you quote both the cash and finance totals?
How much less would it be without delivery?
What would my current car contribute to the deal?
Can you tell me the rate and the length of the loan?
How much would the last payment be?
What sort of discount is possible on a demonstrator?
Can I get a breakdown of the deposit and the remaining balance?
What would the payment be if I chose the cheaper trim?
What's the best price you can do with the wheels included?
Could you send the purchase figures again in Canadian dollars?
Hi,\n\nCould you send a written quote including tax and all mandatory fees? I want to compare complete totals rather than advertised prices.\n\nLeah
Hello,\n\nWhat would the monthly payment be with $4,000 down over four years? Please include the rate used in the calculation.\n\nAiden
Hi,\n\nCould I have the price without the optional protection package? I would like to see what that changes in the total.\n\nSofia
Hello,\n\nWhat trade allowance would you estimate for my 2016 Elantra? It has roughly 145,000 kilometres on it.\n\nNabil
Hi,\n\nCould you explain which fees are included in the figure shown in the advert? I need the full purchase amount.\n\nElsa
Hello,\n\nWhat would a three-year lease on the advertised van cost every month? I'd like the down payment listed separately.\n\nTomas
Hi,\n\nIs there any flexibility in the asking price? I would be interested in a revised cash figure.\n\nRhea
Hello,\n\nPlease send an itemised quote for the blue hatchback, including the winter-wheel package.\n\nNoel
Hi,\n\nWhat rate would apply if I shortened the finance term to three years? I'm trying to compare the total borrowing cost.\n\nFarah
Hello,\n\nCould you resend the purchase figures? The earlier attachment did not download, and I still need the total after tax.\n\nMason
Hi,\n\nHow much would delivery to Kingston add to the offer? I already have the vehicle price and need that extra charge.\n\nAva
Hello,\n\nCould I have an estimate of the trade value before I decide whether to sell my current car privately?\n\nKarim
Hi,\n\nWhat would the payment become if I increased the deposit to $6,000? Please keep the same loan term for comparison.\n\nAnika
Hello,\n\nCould you quote the car without any optional products? I would like a clear base purchase total.\n\nMax
Hi,\n\nWhat is the amount required to reserve a vehicle, and how much of it would be refundable?\n\nBelle
Hello,\n\nCan I see a breakdown of the finance offer, including the interest rate and any final payment?\n\nYusuf
Hi,\n\nIs there a reduced price for the demonstrator compared with the advertised new example? Please send both figures.\n\nEmma
Hello,\n\nWhat would the total be with the extended coverage included? I want to know the added cost separately as well.\n\nTheo
Hi,\n\nCould you give me an out-the-door figure for the car in this listing? Tax and mandatory fees are what I'm trying to account for.\n\nSasha
Hello,\n\nWhat would you offer for a 2015 Mazda3 in trade against this purchase? I can send mileage and photographs for an estimate.\n\nDarius
''')

add('buyer', 'asks_for_person asks_about_price', r'''
Can a salesperson call me with the total price?
Please have Dana send me a proper quote.
I need a real person to explain what the monthly payments would be.
Could someone from the store text me the all-in number?
Can Arjun phone me with the financing rate?
I'd like a human to go through the fees with me.
Please get Sofia to quote the lease payment.
Can Tom tell me what you'd offer for my trade?
Put me through to somebody who can give me the cash price.
I don't want a bot estimate. Have a salesperson send the figures.
Could a staff member call about the down payment amount?
Please ask the manager to contact me with the best price they can offer.
Can someone explain the loan terms to me over the phone?
I'd rather speak with a person about how much the warranty would add.
Get me a human who can quote the car without the extras.
Could Dana email the complete purchase breakdown?
I need someone at the dealership to tell me the deposit required.
Can a salesperson give me a revised offer directly?
Please have Arjun call with the amount including tax.
Is there a person I can speak to about the interest rate?
Can the manager ring me to discuss a discount?
Have somebody real tell me what my car would be worth in trade.
I'd like Sofia to explain the biweekly payment amount herself.
Please connect me to a salesperson for a cash quote.
Could a staff member email a price with delivery included?
I need Tom to call me with the total after my trade.
Can someone in the showroom quote a shorter lease over the phone?
Please get a person to explain whether those fees are optional.
Could Dana tell me directly what a larger deposit would do to the payment?
I want to speak to someone about the lowest asking price.
Can a human send me the actual financing terms?
Please have the sales team contact me with the amount before tax.
Could Arjun quote both the cash and finance totals in an email?
A real person please. I need to know the full amount I'd owe.
Can someone at the store call with an estimate for my trade-in?
I'd like a salesperson to go through the cost of the protection package.
Please put me through to the manager to discuss the advertised rate.
Could Sofia email a revised figure without the warranty?
I need a staff member to explain what I would pay up front.
Can Tom phone me with the monthly cost over four years?
Get a human to answer this: how much is the documentation fee?
Could a salesperson send the price for the vehicle in the second advert?
I would rather discuss the deposit and refund amount with a real person.
Please ask Dana to contact me with an itemised quote.
Can somebody who works there tell me the final payment amount?
I need a person on the phone to explain the total borrowing cost.
Please have Arjun email the out-the-door number on the hatchback.
Can the manager tell me directly whether the sticker is negotiable?
I'd like someone from the dealership to quote the wheel package by email.
Could a human explain which interest rate was used in that estimate?
Please get Sofia to ring me with the total including mandatory fees.
Can I talk to a salesperson about a trade allowance?
Have Tom send me a purchase quote, not another automated message.
Could somebody from the store call and explain the delivery charge?
I need a real employee to answer how much that option costs.
Please transfer me to someone who can price a three-year lease.
Could Dana phone me to go through the finance breakdown?
I'd like the sales manager to email the best cash figure.
Can a person tell me what the payment would be with $5,000 down?
Please ask Arjun to send me the purchase figures himself.
Who can I speak to at the store to get a complete quote?
I want a human to explain the price difference between the two trims.
Could Sofia contact me about how much you would take off the demonstrator?
Please have a salesperson call with the amount still owing after my trade.
Can someone real quote it without the optional products?
I need Tom to explain the rate and the length of the loan by phone.
Please get a person to work through the monthly cost with me.
Can the manager ring me with an offer for my old van?
Could a staff member email a quote with the extra tyres included?
I'd like Dana to tell me directly whether there's a fee to hold the car.
I need to hear from a human about the full price, not just the sticker.
Could Arjun call with the payment for a shorter term?
Please connect me to somebody who can explain the lease charges.
Can a salesperson email an estimate of what my Corolla is worth?
Have someone from the dealership contact me with a revised total.
I'd prefer Sofia to explain the optional fees over a call.
Could a real person quote the warranty separately from the car?
Please have Tom ring me with the cash purchase figure.
Can someone at reception put me through to a salesperson for a price breakdown?
I want to speak to the manager about the amount of the discount.
Please get Dana to send the quote again directly; the attachment didn't open.
Can a human answer whether the quoted total includes tax?
Could Arjun explain the upfront amount to me on the phone?
I need someone who actually works there to tell me the interest rate.
Please have a staff member contact me with the price of the silver one.
Could Sofia call me about the cost of delivery to Ottawa?
Can I talk to a real person about how the trade changes the balance?
Have Tom email the total for the cheaper trim.
I need a salesperson to tell me what a two-year lease would cost.
Please ask the manager to contact me with a lower offer if one is possible.
person pls, whats the all in price
can sumone call with the monthly figure
no more bot answers get me a rep with a quote
need dana to text me the total after tax
can a human go thru the fees with me
get arjun to ring me about the rate pls
someone real tell me what u'd give for my trade
rep please, how much down would i need
can sofia send the cash numbers herself
ask tom to call me with the lease amount
I'd like a real person to call. What would this cost over the full term?
Can someone from sales reply directly with the price before tax and the final total?
Please have Dana contact me; I need a quote including the warranty rather than a generic explanation.
Could a staff member phone after six and tell me what the monthly amount would be?
I don't understand the finance example. Can Arjun call and give me the rate and payment for my chosen term?
Can a human get back to me with a valuation for my current vehicle?
Please put me through to somebody who can give me an actual number for the car I linked.
Could Sofia contact me with an offer that excludes the protection products?
Have a salesperson ring me, please. I'm asking how much cash I'd need at the start.
Can Tom explain the total including delivery and tax over the phone?
I want a human response about the discount, even if the answer is that you can't reduce it.
Please ask someone at the store to email a complete lease quote with the fees shown separately.
Could the manager call me with the best figure for an outright purchase?
I'm not looking for another calculator link. Can Dana tell me directly what the payment would be?
Can a salesperson get in touch about how much you'd allow for my old hatchback?
Please have Arjun ring me. What would the same deal cost if the loan were a year shorter?
Could a person email the price with both sets of wheels included?
I need someone at the dealership to explain the amount of the final instalment to me.
Please get Sofia to contact me with the actual deposit and remaining balance.
Can Tom phone with a proper out-the-door quote instead of the advertised starting figure?
Hi,\n\nCould a salesperson call me with the full purchase price including tax? I want to discuss the actual figures with a person.\n\nLevi
Hello,\n\nPlease have Dana email an itemised quote. The automated replies haven't given me the mandatory fees.\n\nNadia
Hi,\n\nWould Arjun phone me after work to explain the finance rate and monthly payment? I need a human to go through the numbers.\n\nOmar
Hello,\n\nCould someone at the store contact me with an estimated trade value for my current car? I would rather discuss it directly.\n\nElla
Hi,\n\nPlease ask Sofia to send me a cash quote without the optional protection package. I'd like her to reply herself.\n\nHamza
Hello,\n\nCan Tom call me with the amount I'd need to put down? I am finding the automated finance example difficult to follow.\n\nRose
Hi,\n\nI would like to speak to the manager about the best price you could offer. Could they get in touch by phone?\n\nLiam
Hello,\n\nCould a member of staff email me a lease quote that shows the payment and fees separately? Please transfer this enquiry to a person.\n\nAmal
Hi,\n\nPlease have Dana call about the warranty price. I want to hear from somebody at the dealership rather than receive another link.\n\nEthan
Hello,\n\nCould Arjun get back to me with the total after applying my trade? I'd appreciate a direct explanation by email.\n\nZoe
Hi,\n\nCan a salesperson phone me to discuss the interest rate on a shorter loan? A personal explanation would help.\n\nIdris
Hello,\n\nPlease ask Sofia to email a quote for the car in the attached advert. I need a person to handle the price enquiry.\n\nLucy
Hi,\n\nWould Tom call with the cost including delivery to our address? I would like to talk it through before making a decision.\n\nNoor
Hello,\n\nCan someone from the store tell me directly how much the extra wheel package would add? Please have a staff member contact me.\n\nTheo
Hi,\n\nPlease have the manager ring me about whether there is room for a discount. I want a human answer, even if the price is fixed.\n\nIsla
Hello,\n\nCould Dana contact me with an offer for my old vehicle? I'd like to explain its condition to her and hear the trade figure.\n\nAmir
Hi,\n\nPlease get a salesperson to send a complete out-the-door quote. The automatic messages keep repeating the sticker price.\n\nEva
Hello,\n\nCould Arjun call with the monthly amount over three years and over four years? I would rather compare the figures with him.\n\nRory
Hi,\n\nI need a person to explain the fee breakdown. Would Sofia email it and then arrange a call if anything remains unclear?\n\nLina
Hello,\n\nPlease have Tom contact me with the actual deposit required. I am not looking for a general description of how deposits work.\n\nEvan
Hi,\n\nCould someone from sales phone and quote the car without the warranty? I want to understand that price before choosing extras.\n\nMira
Hello,\n\nPlease transfer me to a human who can explain the finance offer, including the final payment.\n\nJasper
Hi,\n\nWould Dana send the purchase figures again in a direct email? I still need to know the total with tax.\n\nLayla
Hello,\n\nCould a staff member get back to me with a quote including both sets of tyres? I'd like a personal response about the amount.\n\nNathan
Hi,\n\nPlease ask Arjun to call me about a lower cash price for the demonstrator. I want to discuss an offer with him directly.\n\nSafiya
Hello,\n\nCan a real person tell me what the balance would be after my down payment? Please have someone at the store call.\n\nLuke
Hi,\n\nI would like Sofia to explain the borrowing cost over the whole term. Could she contact me rather than send another automated example?\n\nAisha
Hello,\n\nPlease have Tom email an estimate of my trade allowance. I would like to hear the figure from him.\n\nElias
Hi,\n\nCould the manager call me with the best price for an outright purchase? I don't need the finance calculator.\n\nNaomi
Hello,\n\nWould someone from the dealership contact me about the cost of the optional coverage? I'd prefer a human explanation.\n\nZain
Hi,\n\nPlease ask Dana to provide a written quote with delivery included. Could she reply directly when she has the figures?\n\nMaya
Hello,\n\nCan Arjun ring me with the rate used in the proposed payment? I need someone to explain where the number comes from.\n\nHarris
Hi,\n\nPlease put me through to a salesperson who can price the less expensive trim for me.\n\nElena
Hello,\n\nCould Sofia contact me with a revised offer that leaves out the extra products? I'd like to review her actual quote.\n\nAdam
Hi,\n\nWould a staff member call me about the amount required up front? I need a direct answer on the deposit and fees.\n\nSana
Hello,\n\nPlease ask Tom to email both the cash total and the finance total. I want a person at the store to handle the comparison.\n\nGeorge
Hi,\n\nCould the manager speak with me about a possible reduction in the asking price? Please have them contact me.\n\nHiba
Hello,\n\nI need a human to give me the full price on the advertised wagon. Could somebody from sales write back with it?\n\nOliver
Hi,\n\nPlease have Dana call with a three-year lease quote, including any charges due at the start.\n\nRania
Hello,\n\nCould Arjun explain how much would remain after trading in my current car? I'd like him to get in touch directly.\n\nFelix
''')
