import { Component } from '@angular/core';
import {HamIntro} from "./ham_intro/ham_intro.component";
import {HamQSL} from "./ham_qsl/ham_qsl.component";
import {AntennaBuild} from "./antenna-build/antenna-build.component";
import {EchoLink} from "./echo_link/echolink.component";
import {Toolbox} from "./toolbox/toolbox.component";
import {Keyer} from "./keyer/keyer.component";

@Component({
    standalone: true,
    templateUrl: './af0fr.page.html',
    imports: [
        HamIntro,
        Toolbox,
        HamQSL,
        AntennaBuild,
        EchoLink,
        Keyer
    ]
})
export class Af0frPage {}