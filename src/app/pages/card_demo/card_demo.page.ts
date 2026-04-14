import { Component } from '@angular/core';
import {JCARCQSLCard} from "./jcarc_qsl_card/jcarc_qsl_card.component";

@Component({
    standalone: true,
    templateUrl: './card_demo.page.html',
    imports: [
        JCARCQSLCard
    ]
})
export class CardDemoPage {}